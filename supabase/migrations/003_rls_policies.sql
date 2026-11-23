-- Replace the permissive starter policies with service-unit and assignment scoped policies.
-- Apply after 002_production_workflows.sql.

create or replace function public.current_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active = true
$$;

create or replace function public.current_service_unit_id() returns uuid
language sql stable security definer set search_path = public as $$
  select service_unit_id from public.profiles where id = auth.uid() and active = true
$$;

create or replace function public.is_clinical_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() in ('admin', 'nurse')
$$;

create or replace function public.can_read_follow_up(target_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.follow_ups f
    join public.appointments a on a.id = f.appointment_id
    join public.patients p on p.id = a.patient_id
    where f.id = target_id
      and (
        (public.is_clinical_staff() and p.service_unit_id = public.current_service_unit_id())
        or (f.assigned_volunteer_id = auth.uid() and f.status <> 'closed')
      )
  )
$$;

do $$
declare
  policy_name text;
  target_table text;
begin
  for policy_name in select unnest(array[
    'staff read profiles', 'users update own profile', 'staff read patients', 'clinical staff manage patients',
    'staff read appointments', 'clinical staff manage appointments', 'staff read follow ups', 'clinical staff manage follow ups',
    'volunteer update assigned follow ups', 'staff read activities', 'staff add activities', 'staff read checkins',
    'clinical staff manage checkins', 'clinical staff read notifications'
  ]) loop
    target_table := case
      when policy_name like '%profiles%' then 'profiles'
      when policy_name like '%patients%' then 'patients'
      when policy_name like '%appointments%' then 'appointments'
      when policy_name like '%follow ups%' then 'follow_ups'
      when policy_name like '%activities%' then 'follow_up_activities'
      when policy_name like '%checkins%' then 'check_ins'
      else 'notification_logs'
    end;
    execute format('drop policy if exists %I on public.%I', policy_name, target_table);
  end loop;
end $$;

create policy "service unit read profiles" on public.profiles for select to authenticated
using (id = auth.uid() or (public.is_clinical_staff() and service_unit_id = public.current_service_unit_id()));

create policy "users update own profile safely" on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = public.current_role() and service_unit_id = public.current_service_unit_id());

create policy "service unit read patients" on public.patients for select to authenticated
using (
  (public.is_clinical_staff() and service_unit_id = public.current_service_unit_id())
  or exists (
    select 1 from public.follow_ups f
    join public.appointments a on a.id = f.appointment_id
    where a.patient_id = patients.id and f.assigned_volunteer_id = auth.uid() and f.status <> 'closed'
  )
);

create policy "clinical staff manage patients" on public.patients for all to authenticated
using (public.is_clinical_staff() and service_unit_id = public.current_service_unit_id())
with check (public.is_clinical_staff() and service_unit_id = public.current_service_unit_id());

create policy "service unit read appointments" on public.appointments for select to authenticated
using (
  (public.is_clinical_staff() and exists (select 1 from public.patients p where p.id = appointments.patient_id and p.service_unit_id = public.current_service_unit_id()))
  or exists (select 1 from public.follow_ups f where f.appointment_id = appointments.id and f.assigned_volunteer_id = auth.uid() and f.status <> 'closed')
);

create policy "clinical staff manage appointments" on public.appointments for all to authenticated
using (public.is_clinical_staff() and exists (select 1 from public.patients p where p.id = appointments.patient_id and p.service_unit_id = public.current_service_unit_id()))
with check (public.is_clinical_staff() and exists (select 1 from public.patients p where p.id = appointments.patient_id and p.service_unit_id = public.current_service_unit_id()));

create policy "service unit read follow ups" on public.follow_ups for select to authenticated
using (public.can_read_follow_up(id));

create policy "clinical staff manage follow ups" on public.follow_ups for all to authenticated
using (public.is_clinical_staff() and exists (select 1 from public.appointments a join public.patients p on p.id = a.patient_id where a.id = follow_ups.appointment_id and p.service_unit_id = public.current_service_unit_id()))
with check (public.is_clinical_staff() and exists (select 1 from public.appointments a join public.patients p on p.id = a.patient_id where a.id = follow_ups.appointment_id and p.service_unit_id = public.current_service_unit_id()));

create policy "volunteer update assigned follow ups" on public.follow_ups for update to authenticated
using (assigned_volunteer_id = auth.uid() and status <> 'closed')
with check (assigned_volunteer_id = auth.uid());

create policy "service unit read activities" on public.follow_up_activities for select to authenticated
using (public.can_read_follow_up(follow_up_id));
create policy "assigned staff add activities" on public.follow_up_activities for insert to authenticated
with check (performed_by = auth.uid() and public.can_read_follow_up(follow_up_id));

create policy "service unit read checkins" on public.check_ins for select to authenticated
using (public.is_clinical_staff() and exists (select 1 from public.appointments a join public.patients p on p.id = a.patient_id where a.id = check_ins.appointment_id and p.service_unit_id = public.current_service_unit_id()));
create policy "clinical staff manage checkins" on public.check_ins for all to authenticated
using (public.is_clinical_staff() and exists (select 1 from public.appointments a join public.patients p on p.id = a.patient_id where a.id = check_ins.appointment_id and p.service_unit_id = public.current_service_unit_id()))
with check (public.is_clinical_staff());

create policy "clinical staff read notifications" on public.notification_logs for select to authenticated
using (public.is_clinical_staff() and exists (select 1 from public.appointments a join public.patients p on p.id = a.patient_id where a.id = notification_logs.appointment_id and p.service_unit_id = public.current_service_unit_id()));

alter table public.service_units enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_row_errors enable row level security;
alter table public.audit_logs enable row level security;

create policy "staff read own service unit" on public.service_units for select to authenticated
using (id = public.current_service_unit_id());

create policy "clinical staff read imports" on public.import_batches for select to authenticated
using (public.is_clinical_staff() and exists (select 1 from public.profiles p where p.id = created_by and p.service_unit_id = public.current_service_unit_id()));

create policy "clinical staff read import errors" on public.import_row_errors for select to authenticated
using (public.is_clinical_staff() and exists (select 1 from public.import_batches b join public.profiles p on p.id = b.created_by where b.id = batch_id and p.service_unit_id = public.current_service_unit_id()));

-- Audit, webhook and notification writes are performed by trusted server code only.

