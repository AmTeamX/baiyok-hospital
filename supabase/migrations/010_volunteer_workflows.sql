-- STEP 6 — Volunteer workflow: result recording, escalation and SLA reminders.
-- Apply after 007_assignment_notifications.sql (numbered 010 to avoid colliding with
-- the RLS-recursion fix migrations 008/009). Never edit a migration already applied in production.
--
-- Adds two service-role functions that enforce assignment scoping on the server:
--   1. record_volunteer_result() — a volunteer records a follow-up outcome.
--   2. escalate_follow_up()     — a volunteer requests nurse assistance.
-- Also adds service_units.sla_hours to drive the SLA reminder job.
--
-- Rollback / forward-fix note: these are `create or replace function`; to remove,
-- run `drop function if exists public.record_volunteer_result(uuid, uuid, text, text, text, integer);`
-- and `drop function if exists public.escalate_follow_up(uuid, uuid, text, integer);`
-- and `alter table public.service_units drop column if exists sla_hours;`.

alter table public.service_units
  add column if not exists sla_hours integer not null default 48 check (sla_hours between 1 and 720);

-- ---------------------------------------------------------------------------
-- Record a volunteer follow-up result. Appends an activity, marks the follow-up
-- as contacted, and (only for `needs_nurse`) raises priority to urgent. The actor
-- must be an active volunteer and the assigned owner of the follow-up.
-- ---------------------------------------------------------------------------
create or replace function public.record_volunteer_result(
  p_follow_up_id uuid,
  p_actor_id uuid,
  p_result_code text,
  p_note text,
  p_channel text,
  p_expected_version integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_follow_up public.follow_ups;
  v_unit uuid;
  v_channel text;
  v_note text;
  v_priority text;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'volunteer' and active = true
  ) then
    raise exception 'volunteer_forbidden' using errcode = '42501';
  end if;

  select * into v_follow_up from public.follow_ups where id = p_follow_up_id;
  if not found then
    raise exception 'follow_up_not_found' using errcode = 'P0002';
  end if;

  -- A volunteer may only record a result for their own assignment.
  if v_follow_up.assigned_volunteer_id is null or v_follow_up.assigned_volunteer_id <> p_actor_id then
    raise exception 'follow_up_not_assigned' using errcode = '42501';
  end if;

  if v_follow_up.status in ('returned', 'closed', 'rescheduled') then
    raise exception 'follow_up_not_open' using errcode = 'P0006';
  end if;

  if v_follow_up.version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'P0004';
  end if;

  select p.service_unit_id into v_unit
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  where a.id = v_follow_up.appointment_id;

  v_channel := case when p_channel in ('phone', 'visit', 'line', 'other') then p_channel else 'other' end;
  v_note := nullif(btrim(coalesce(p_note, '')), '');
  v_priority := case when p_result_code = 'needs_nurse' then 'urgent' else v_follow_up.priority end;

  insert into public.follow_up_activities (follow_up_id, activity_type, note, performed_by)
  values (
    p_follow_up_id,
    p_result_code,
    case when v_note is null then v_channel else v_channel || ': ' || v_note end,
    p_actor_id
  );

  update public.follow_ups
  set status = 'contacted',
      contacted_at = coalesce(contacted_at, now()),
      priority = v_priority,
      version = version + 1,
      updated_at = now()
  where id = p_follow_up_id;

  insert into public.audit_logs (actor_id, actor_role, service_unit_id, action, entity_type, entity_id, before_data, after_data)
  values (
    p_actor_id, 'volunteer'::public.app_role, v_unit, 'volunteer_result_recorded', 'follow_up', p_follow_up_id,
    jsonb_build_object('status', v_follow_up.status, 'priority', v_follow_up.priority, 'version', v_follow_up.version),
    jsonb_build_object('result_code', p_result_code, 'channel', v_channel, 'status', 'contacted', 'priority', v_priority, 'version', v_follow_up.version + 1)
  );

  return jsonb_build_object(
    'follow_up_id', p_follow_up_id,
    'version', v_follow_up.version + 1,
    'status', 'contacted',
    'priority', v_priority
  );
end;
$$;

revoke all on function public.record_volunteer_result(uuid, uuid, text, text, text, integer) from public;
grant execute on function public.record_volunteer_result(uuid, uuid, text, text, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Volunteer escalates a follow-up to the nurse. Appends an escalation activity
-- and raises priority to urgent so it surfaces in the staff registry/timeline.
-- ---------------------------------------------------------------------------
create or replace function public.escalate_follow_up(
  p_follow_up_id uuid,
  p_actor_id uuid,
  p_note text,
  p_expected_version integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_follow_up public.follow_ups;
  v_unit uuid;
  v_note text;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'volunteer' and active = true
  ) then
    raise exception 'volunteer_forbidden' using errcode = '42501';
  end if;

  select * into v_follow_up from public.follow_ups where id = p_follow_up_id;
  if not found then
    raise exception 'follow_up_not_found' using errcode = 'P0002';
  end if;

  if v_follow_up.assigned_volunteer_id is null or v_follow_up.assigned_volunteer_id <> p_actor_id then
    raise exception 'follow_up_not_assigned' using errcode = '42501';
  end if;

  if v_follow_up.status in ('returned', 'closed', 'rescheduled') then
    raise exception 'follow_up_not_open' using errcode = 'P0006';
  end if;

  if v_follow_up.version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'P0004';
  end if;

  select p.service_unit_id into v_unit
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  where a.id = v_follow_up.appointment_id;

  v_note := nullif(btrim(coalesce(p_note, '')), '');

  insert into public.follow_up_activities (follow_up_id, activity_type, note, performed_by)
  values (p_follow_up_id, 'escalation_requested', v_note, p_actor_id);

  update public.follow_ups
  set priority = 'urgent',
      version = version + 1,
      updated_at = now()
  where id = p_follow_up_id;

  insert into public.audit_logs (actor_id, actor_role, service_unit_id, action, entity_type, entity_id, before_data, after_data)
  values (
    p_actor_id, 'volunteer'::public.app_role, v_unit, 'volunteer_escalated', 'follow_up', p_follow_up_id,
    jsonb_build_object('priority', v_follow_up.priority, 'version', v_follow_up.version),
    jsonb_build_object('priority', 'urgent', 'version', v_follow_up.version + 1)
  );

  return jsonb_build_object(
    'follow_up_id', p_follow_up_id,
    'version', v_follow_up.version + 1,
    'priority', 'urgent'
  );
end;
$$;

revoke all on function public.escalate_follow_up(uuid, uuid, text, integer) from public;
grant execute on function public.escalate_follow_up(uuid, uuid, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- SLA reminder outbox: enqueue a reminder notification for each assigned but
-- uncontacted follow-up that has passed the service unit's SLA window. Safe to
-- re-run — the idempotency key prevents a second reminder for the same follow-up.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_sla_reminders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit record;
  v_cutoff timestamptz;
  v_enqueued integer;
  v_total integer := 0;
begin
  for v_unit in
    select id, sla_hours from public.service_units where active = true
  loop
    v_cutoff := now() - make_interval(hours => v_unit.sla_hours);

    insert into public.notification_logs (
      appointment_id, follow_up_id, recipient_profile_id, kind, channel, status,
      idempotency_key, attempt_count, next_attempt_at
    )
    select f.appointment_id, f.id, f.assigned_volunteer_id,
           'follow_up_sla_reminder', 'line', 'pending',
           'follow_up_sla_reminder:' || f.id::text,
           0, now()
    from public.follow_ups f
    join public.appointments a on a.id = f.appointment_id
    join public.patients p on p.id = a.patient_id
    where p.service_unit_id = v_unit.id
      and f.status = 'assigned'
      and f.assigned_volunteer_id is not null
      and f.assigned_at is not null
      and f.assigned_at <= v_cutoff
    on conflict (idempotency_key) do nothing;

    get diagnostics v_enqueued = row_count;
    v_total := v_total + v_enqueued;
  end loop;

  return jsonb_build_object('enqueued', v_total, 'at', now());
end;
$$;

revoke all on function public.enqueue_sla_reminders() from public;
grant execute on function public.enqueue_sla_reminders() to service_role;
