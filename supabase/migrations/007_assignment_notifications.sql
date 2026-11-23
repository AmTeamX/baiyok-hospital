-- Assignment + notification outbox support. Apply after 006_line_identity.sql.
-- Extends notification_logs with an 'unlinked' terminal state and last-attempt tracking,
-- then adds an atomic, service-role-only assign/reassign RPC that writes the follow-up,
-- assignment history, audit log and an outbox notification in a single transaction.

alter table public.notification_logs drop constraint if exists notification_logs_status_check;
alter table public.notification_logs add constraint notification_logs_status_check
  check (status in ('pending', 'processing', 'sent', 'failed', 'dead_letter', 'unlinked'));

alter table public.notification_logs add column if not exists last_attempt_at timestamptz;
alter table public.notification_logs add column if not exists created_at timestamptz not null default now();

create or replace function public.assign_follow_up(
  p_follow_up_id uuid,
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
  v_follow_up public.follow_ups;
  v_volunteer public.profiles;
  v_old_volunteer uuid;
  v_reassigned boolean;
  v_line_user_id text;
  v_notification_status text;
  v_notification_id uuid;
begin
  select role, service_unit_id into v_actor_role, v_actor_unit
  from public.profiles
  where id = p_actor_id and active = true;

  if v_actor_role not in ('admin', 'nurse') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_follow_up from public.follow_ups where id = p_follow_up_id;
  if not found then
    raise exception 'follow_up_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.appointments a
    join public.patients p on p.id = a.patient_id
    where a.id = v_follow_up.appointment_id
      and p.service_unit_id = v_actor_unit
  ) then
    raise exception 'follow_up_forbidden' using errcode = '42501';
  end if;

  select * into v_volunteer from public.profiles where id = p_volunteer_id;
  if not found or v_volunteer.role <> 'volunteer' or v_volunteer.active <> true
     or v_volunteer.service_unit_id <> v_actor_unit then
    raise exception 'volunteer_invalid' using errcode = 'P0003';
  end if;

  v_old_volunteer := v_follow_up.assigned_volunteer_id;
  v_reassigned := v_old_volunteer is not null and v_old_volunteer <> p_volunteer_id;

  -- LINE identity lives in line_account_links (active volunteer link), not profiles.line_user_id.
  select la.line_user_id into v_line_user_id
  from public.line_account_links lal
  join public.line_accounts la on la.id = lal.line_account_id
  where lal.role = 'volunteer'
    and lal.profile_id = p_volunteer_id
    and lal.status = 'active'
  limit 1;

  update public.follow_ups
  set assigned_volunteer_id = p_volunteer_id,
      assigned_at = now(),
      status = 'assigned',
      version = version + 1,
      updated_at = now()
  where id = p_follow_up_id;

  insert into public.follow_up_activities (follow_up_id, activity_type, note, performed_by)
  values (
    p_follow_up_id,
    case when v_reassigned then 'assignment_reassigned' else 'assignment_created' end,
    case when v_reassigned then 'เปลี่ยนผู้รับผิดชอบเป็น ' || v_volunteer.full_name
         else 'มอบหมายให้ ' || v_volunteer.full_name end,
    p_actor_id
  );

  insert into public.audit_logs (actor_id, actor_role, service_unit_id, action, entity_type, entity_id, before_data, after_data)
  values (
    p_actor_id, v_actor_role, v_actor_unit, 'follow_up_assigned', 'follow_up', p_follow_up_id,
    jsonb_build_object('assigned_volunteer_id', v_old_volunteer),
    jsonb_build_object('assigned_volunteer_id', p_volunteer_id, 'status', 'assigned')
  );

  v_notification_status := case when v_line_user_id is null then 'unlinked' else 'pending' end;

  insert into public.notification_logs (
    appointment_id, follow_up_id, recipient_profile_id, kind, channel, status,
    idempotency_key, attempt_count, next_attempt_at
  )
  values (
    v_follow_up.appointment_id, p_follow_up_id, p_volunteer_id,
    'follow_up_assigned', 'line', v_notification_status,
    'follow_up_assigned:' || p_follow_up_id::text || ':' || p_volunteer_id::text,
    0,
    case when v_notification_status = 'pending' then now() else null end
  )
  on conflict (idempotency_key) do nothing
  returning id into v_notification_id;

  return jsonb_build_object(
    'follow_up_id', p_follow_up_id,
    'volunteer_id', p_volunteer_id,
    'reassigned', v_reassigned,
    'idempotent', v_notification_id is null,
    'notification_id', v_notification_id,
    'notification_status', v_notification_status
  );
end;
$$;

revoke all on function public.assign_follow_up(uuid, uuid, uuid) from public;
grant execute on function public.assign_follow_up(uuid, uuid, uuid) to service_role;

create or replace function public.reschedule_follow_up(
  p_follow_up_id uuid,
  p_appointment_at timestamptz,
  p_priority text,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.app_role;
  v_actor_unit uuid;
  v_follow_up public.follow_ups;
  v_appointment public.appointments;
  v_new_appointment_id uuid;
  v_priority text;
begin
  select role, service_unit_id into v_actor_role, v_actor_unit
  from public.profiles
  where id = p_actor_id and active = true;

  if v_actor_role not in ('admin', 'nurse') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_follow_up from public.follow_ups where id = p_follow_up_id;
  if not found then
    raise exception 'follow_up_not_found' using errcode = 'P0002';
  end if;

  select * into v_appointment from public.appointments where id = v_follow_up.appointment_id;
  if not found or not exists (
    select 1 from public.patients p where p.id = v_appointment.patient_id and p.service_unit_id = v_actor_unit
  ) then
    raise exception 'follow_up_forbidden' using errcode = '42501';
  end if;

  v_priority := case when p_priority in ('normal', 'high', 'urgent') then p_priority else 'normal' end;

  insert into public.appointments (patient_id, clinic, appointment_at, status, source_system)
  values (v_appointment.patient_id, v_appointment.clinic, p_appointment_at, 'scheduled', 'manual')
  returning id into v_new_appointment_id;

  update public.appointments
  set status = 'rescheduled', superseded_by_appointment_id = v_new_appointment_id, updated_at = now()
  where id = v_appointment.id;

  update public.follow_ups
  set new_appointment_id = v_new_appointment_id,
      status = 'rescheduled',
      priority = v_priority::text,
      version = version + 1,
      updated_at = now()
  where id = p_follow_up_id;

  insert into public.follow_up_activities (follow_up_id, activity_type, note, performed_by)
  values (p_follow_up_id, 'rescheduled', 'นัดใหม่โดยเจ้าหน้าที่', p_actor_id);

  insert into public.audit_logs (actor_id, actor_role, service_unit_id, action, entity_type, entity_id, after_data)
  values (
    p_actor_id, v_actor_role, v_actor_unit, 'follow_up_rescheduled', 'follow_up', p_follow_up_id,
    jsonb_build_object('new_appointment_id', v_new_appointment_id, 'priority', v_priority, 'appointment_at', p_appointment_at)
  );

  return jsonb_build_object(
    'follow_up_id', p_follow_up_id,
    'new_appointment_id', v_new_appointment_id,
    'priority', v_priority
  );
end;
$$;

revoke all on function public.reschedule_follow_up(uuid, timestamptz, text, uuid) from public;
grant execute on function public.reschedule_follow_up(uuid, timestamptz, text, uuid) to service_role;
