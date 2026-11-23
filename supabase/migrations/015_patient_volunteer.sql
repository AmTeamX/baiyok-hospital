-- Patient-level volunteer assignment.
-- Apply after 014_blocked_oa.sql. Never edit a migration already applied in production.
--
-- Adds patients.assigned_volunteer_id so a patient has a responsible volunteer,
-- then inherits that volunteer onto newly-created follow-ups (with a push) and
-- provides assign_volunteer_to_patient() to (re)assign at the patient level and
-- backfill the patient's currently-pending follow-ups.

alter table public.patients add column if not exists assigned_volunteer_id uuid references public.profiles(id);
create index if not exists patients_assigned_volunteer_idx on public.patients(assigned_volunteer_id) where assigned_volunteer_id is not null;

-- When a follow-up is created without an assignee, inherit the patient's responsible
-- volunteer and notify them. Idempotent by construction (only fires when the incoming
-- follow-up has no assigned_volunteer_id).
create or replace function public.inherit_patient_volunteer() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_volunteer uuid;
begin
  if new.assigned_volunteer_id is null then
    select p.assigned_volunteer_id into v_volunteer
    from public.appointments a
    join public.patients p on p.id = a.patient_id
    where a.id = new.appointment_id;

    if v_volunteer is not null then
      update public.follow_ups
      set assigned_volunteer_id = v_volunteer, assigned_at = now(), status = 'assigned', updated_at = now()
      where id = new.id;

      insert into public.notification_logs (
        appointment_id, follow_up_id, recipient_profile_id, kind, channel, status,
        idempotency_key, attempt_count, next_attempt_at
      )
      values (
        new.appointment_id, new.id, v_volunteer, 'follow_up_assigned', 'line', 'pending',
        'follow_up_assigned:' || new.id::text || ':' || v_volunteer::text, 0, now()
      )
      on conflict (idempotency_key) do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists follow_ups_inherit_volunteer on public.follow_ups;
create trigger follow_ups_inherit_volunteer
after insert on public.follow_ups
for each row execute function public.inherit_patient_volunteer();

-- (Re)assign a patient's responsible volunteer and backfill their pending follow-ups.
create or replace function public.assign_volunteer_to_patient(
  p_patient_id uuid,
  p_volunteer_id uuid,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.app_role;
  v_actor_unit uuid;
  v_volunteer public.profiles;
  v_follow_up record;
  v_assigned integer := 0;
begin
  select role, service_unit_id into v_actor_role, v_actor_unit
  from public.profiles where id = p_actor_id and active = true;
  if v_actor_role not in ('admin', 'nurse') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.patients where id = p_patient_id and service_unit_id = v_actor_unit) then
    raise exception 'patient_forbidden' using errcode = '42501';
  end if;

  select * into v_volunteer from public.profiles where id = p_volunteer_id;
  if not found or v_volunteer.role <> 'volunteer' or not v_volunteer.active
     or v_volunteer.service_unit_id <> v_actor_unit then
    raise exception 'volunteer_invalid' using errcode = 'P0003';
  end if;

  update public.patients set assigned_volunteer_id = p_volunteer_id where id = p_patient_id;

  for v_follow_up in
    select f.id, f.appointment_id
    from public.follow_ups f
    join public.appointments a on a.id = f.appointment_id
    where a.patient_id = p_patient_id and f.status = 'pending'
  loop
    update public.follow_ups
    set assigned_volunteer_id = p_volunteer_id, assigned_at = now(), status = 'assigned', version = version + 1, updated_at = now()
    where id = v_follow_up.id;

    insert into public.notification_logs (
      appointment_id, follow_up_id, recipient_profile_id, kind, channel, status,
      idempotency_key, attempt_count, next_attempt_at
    )
    values (
      v_follow_up.appointment_id, v_follow_up.id, p_volunteer_id, 'follow_up_assigned', 'line', 'pending',
      'follow_up_assigned:' || v_follow_up.id::text || ':' || p_volunteer_id::text, 0, now()
    )
    on conflict (idempotency_key) do nothing;
    v_assigned := v_assigned + 1;
  end loop;

  insert into public.audit_logs (actor_id, actor_role, service_unit_id, action, entity_type, entity_id, after_data)
  values (
    p_actor_id, v_actor_role, v_actor_unit, 'patient_volunteer_assigned', 'patient', p_patient_id,
    jsonb_build_object('volunteer_id', p_volunteer_id, 'assigned_follow_ups', v_assigned)
  );

  return jsonb_build_object('patient_id', p_patient_id, 'volunteer_id', p_volunteer_id, 'assigned_follow_ups', v_assigned);
end;
$$;

revoke all on function public.assign_volunteer_to_patient(uuid, uuid, uuid) from public;
grant execute on function public.assign_volunteer_to_patient(uuid, uuid, uuid) to service_role;
