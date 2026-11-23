-- Avoid recursive RLS evaluation when patient/appointment policies inspect
-- assignments through follow_ups and appointments.

create or replace function public.can_read_patient(target_id uuid) returns boolean
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.patients p
    where p.id = target_id
      and public.is_clinical_staff()
      and p.service_unit_id = public.current_service_unit_id()
  ) or exists (
    select 1
    from public.follow_ups f
    join public.appointments a on a.id = f.appointment_id
    where a.patient_id = target_id
      and f.assigned_volunteer_id = auth.uid()
      and f.status <> 'closed'
  )
$$;

create or replace function public.can_read_appointment(target_id uuid) returns boolean
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.appointments a
    join public.patients p on p.id = a.patient_id
    where a.id = target_id
      and public.is_clinical_staff()
      and p.service_unit_id = public.current_service_unit_id()
  ) or exists (
    select 1
    from public.follow_ups f
    where f.appointment_id = target_id
      and f.assigned_volunteer_id = auth.uid()
      and f.status <> 'closed'
  )
$$;

create or replace function public.can_read_follow_up(target_id uuid) returns boolean
language sql stable security definer
set search_path = public
set row_security = off
as $$
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

drop policy if exists "service unit read patients" on public.patients;
create policy "service unit read patients" on public.patients for select to authenticated
using (public.can_read_patient(id));

drop policy if exists "service unit read appointments" on public.appointments;
create policy "service unit read appointments" on public.appointments for select to authenticated
using (public.can_read_appointment(id));

drop policy if exists "clinical staff manage appointments" on public.appointments;
create policy "clinical staff manage appointments" on public.appointments for all to authenticated
using (public.is_clinical_staff() and public.can_read_patient(patient_id))
with check (public.is_clinical_staff() and public.can_read_patient(patient_id));
