-- STEP 3 — ตรวจขาดนัดและทะเบียน (MIS-01, MIS-02).
-- Apply after 004_import_commit_rpc.sql. Never edit a migration already applied in production.
--
-- Provides two service-role functions:
--   1. mark_missed_appointments()  — idempotent, atomic mark-missed cron (MIS-01).
--   2. search_missed_follow_ups()  — server-side missed registry query (MIS-02).
--
-- Rollback / forward-fix note: these are `create or replace function`; to remove,
-- run `drop function if exists public.mark_missed_appointments();` and
-- `drop function if exists public.search_missed_follow_ups(...);` (full signature).

-- ---------------------------------------------------------------------------
-- MIS-01: mark scheduled appointments as missed once they pass the service-unit
-- cutoff and have no attendance record, then create exactly one pending
-- follow-up. Safe to re-run: already-missed appointments and appointments that
-- already have an active follow-up are skipped.
-- ---------------------------------------------------------------------------
create or replace function public.mark_missed_appointments()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit record;
  v_cutoff timestamptz;
  v_marked integer;
  v_created integer;
  v_total_marked integer := 0;
  v_total_created integer := 0;
begin
  create temp table if not exists _missed_candidates (
    appointment_id uuid primary key,
    follow_up_id uuid
  ) on commit drop;

  for v_unit in
    select id, missed_cutoff_hours from public.service_units where active = true
  loop
    v_cutoff := now() - make_interval(hours => v_unit.missed_cutoff_hours);
    delete from _missed_candidates;

    insert into _missed_candidates (appointment_id)
    select a.id
    from public.appointments a
    join public.patients p on p.id = a.patient_id
    where p.service_unit_id = v_unit.id
      and a.status = 'scheduled'
      and a.appointment_at <= v_cutoff
      and a.attended_at is null
      and not exists (select 1 from public.check_ins c where c.appointment_id = a.id);
    get diagnostics v_marked = row_count;

    update public.appointments a
    set status = 'missed', missed_marked_at = now(), updated_at = now()
    from _missed_candidates m
    where a.id = m.appointment_id;

    with created as (
      insert into public.follow_ups (appointment_id, status, priority, created_at, updated_at)
      select m.appointment_id, 'pending', 'normal', now(), now()
      from _missed_candidates m
      where not exists (
        select 1 from public.follow_ups f
        where f.appointment_id = m.appointment_id and f.status not in ('closed', 'returned')
      )
      returning appointment_id, id
    )
    update _missed_candidates m
    set follow_up_id = created.id
    from created
    where created.appointment_id = m.appointment_id;
    get diagnostics v_created = row_count;

    -- Enqueue an internal outbox event for the assignment/notification worker.
    insert into public.notification_logs (appointment_id, follow_up_id, kind, channel, status)
    select m.appointment_id, m.follow_up_id, 'missed_follow_up_created', 'internal', 'pending'
    from _missed_candidates m
    where m.follow_up_id is not null;

    insert into public.audit_logs (service_unit_id, action, entity_type, entity_id, after_data)
    select v_unit.id, 'missed_marked', 'appointment', m.appointment_id,
           jsonb_build_object('status', 'missed', 'follow_up_created', m.follow_up_id is not null)
    from _missed_candidates m;

    v_total_marked := v_total_marked + v_marked;
    v_total_created := v_total_created + v_created;
  end loop;

  return jsonb_build_object('marked', v_total_marked, 'follow_ups_created', v_total_created, 'at', now());
end;
$$;

revoke all on function public.mark_missed_appointments() from public;
grant execute on function public.mark_missed_appointments() to service_role;

-- ---------------------------------------------------------------------------
-- MIS-02: missed registry query with search, status, area, assignee, priority,
-- date-range filters plus pagination and sort. Scope is enforced by the caller
-- passing the staff member's service unit id.
-- ---------------------------------------------------------------------------
create or replace function public.search_missed_follow_ups(
  p_service_unit_id uuid,
  p_q text default null,
  p_status text default null,
  p_area text default null,
  p_assignee uuid default null,
  p_unassigned_only boolean default false,
  p_priority text default null,
  p_from date default null,
  p_to date default null,
  p_page integer default 1,
  p_page_size integer default 25,
  p_sort text default 'appointment_at',
  p_order text default 'asc'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offset integer;
  v_sort text := p_sort;
  v_order text := p_order;
  v_rows jsonb;
begin
  if p_page < 1 then p_page := 1; end if;
  if p_page_size < 1 or p_page_size > 100 then p_page_size := 25; end if;
  v_offset := (p_page - 1) * p_page_size;

  if p_status is not null and p_status not in ('pending','assigned','contacted','rescheduled','returned','closed') then
    p_status := null;
  end if;
  if p_priority is not null and p_priority not in ('normal','high','urgent') then
    p_priority := null;
  end if;
  if v_sort not in ('appointment_at','updated_at','priority','days_late','full_name') then
    v_sort := 'appointment_at';
  end if;
  if v_order not in ('asc','desc') then
    v_order := 'asc';
  end if;

  with base as (
    select
      a.id as appointment_id,
      a.appointment_at,
      a.clinic,
      p.hn,
      p.full_name,
      p.birth_date,
      p.village,
      fu.id as follow_up_id,
      fu.status as fu_status,
      fu.missed_reason,
      fu.priority,
      fu.assigned_volunteer_id,
      fu.version,
      fu.updated_at as fu_updated_at,
      vol.full_name as assignee_name
    from public.appointments a
    join public.patients p on p.id = a.patient_id
    left join lateral (
      select f.id, f.status, f.missed_reason, f.priority, f.assigned_volunteer_id, f.version, f.updated_at, f.created_at
      from public.follow_ups f
      where f.appointment_id = a.id
      order by (f.status in ('closed', 'returned')) asc, f.created_at desc
      limit 1
    ) fu on true
    left join public.profiles vol on vol.id = fu.assigned_volunteer_id
    where a.status = 'missed'
      and p.service_unit_id = p_service_unit_id
      and (p_q is null or p.full_name ilike '%' || p_q || '%' or p.hn ilike '%' || p_q || '%' or coalesce(p.village, '') ilike '%' || p_q || '%')
      and (p_area is null or coalesce(p.village, '') ilike '%' || p_area || '%')
      and (p_from is null or a.appointment_at::date >= p_from)
      and (p_to is null or a.appointment_at::date <= p_to)
      and (p_status is null or coalesce(fu.status, 'pending') = p_status::public.follow_up_status)
      and (p_assignee is null or fu.assigned_volunteer_id = p_assignee)
      and (p_unassigned_only is false or fu.assigned_volunteer_id is null)
      and (p_priority is null or coalesce(fu.priority, 'normal') = p_priority)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'page', p_page,
    'page_size', p_page_size,
    'rows', coalesce(
      (select jsonb_agg(row_to_json(t)) from (
        select
          base.appointment_id,
          base.follow_up_id,
          base.hn,
          base.full_name,
          coalesce(extract(year from age(base.birth_date))::int, 0) as age,
          coalesce(base.village, 'ไม่ระบุหมู่บ้าน') as village,
          base.appointment_at,
          base.clinic,
          greatest(0, (current_date - base.appointment_at::date)) as days_late,
          coalesce(base.fu_status, 'pending') as status,
          base.missed_reason,
          coalesce(base.priority, 'normal') as priority,
          base.assigned_volunteer_id,
          base.assignee_name,
          (base.assigned_volunteer_id is null) as unassigned,
          (coalesce(base.fu_status, 'pending') in ('pending', 'assigned') and greatest(0, current_date - base.appointment_at::date) >= 3) as overdue,
          coalesce(base.version, 1) as version
        from base
        order by
          case when v_order = 'asc' then
            case v_sort
              when 'appointment_at' then base.appointment_at::text
              when 'updated_at' then coalesce(base.fu_updated_at::text, base.appointment_at::text)
              when 'priority' then lpad(case coalesce(base.priority, 'normal') when 'urgent' then '0' when 'high' then '1' else '2' end, 2, '0')
              when 'days_late' then lpad((greatest(0, current_date - base.appointment_at::date))::text, 10, '0')
              else base.full_name
            end
          end asc,
          case when v_order = 'desc' then
            case v_sort
              when 'appointment_at' then base.appointment_at::text
              when 'updated_at' then coalesce(base.fu_updated_at::text, base.appointment_at::text)
              when 'priority' then lpad(case coalesce(base.priority, 'normal') when 'urgent' then '0' when 'high' then '1' else '2' end, 2, '0')
              when 'days_late' then lpad((greatest(0, current_date - base.appointment_at::date))::text, 10, '0')
              else base.full_name
            end
          end desc,
          base.appointment_id
        limit p_page_size offset v_offset
      ) t),
      '[]'::jsonb
    )
  ) into v_rows;

  return v_rows;
end;
$$;

revoke all on function public.search_missed_follow_ups(uuid, text, text, text, uuid, boolean, text, date, date, integer, integer, text, text) from public;
grant execute on function public.search_missed_follow_ups(uuid, text, text, text, uuid, boolean, text, date, date, integer, integer, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- MIS-03: optimistic-locked follow-up update and append-only activity.
-- Both functions verify the actor is clinical staff and that the follow-up
-- belongs to the actor's service unit before mutating.
-- ---------------------------------------------------------------------------
create or replace function public.update_follow_up(
  p_follow_up_id uuid,
  p_expected_version integer,
  p_actor_id uuid,
  p_status text,
  p_priority text,
  p_missed_reason text,
  p_reason_note text,
  p_counselling_note text,
  p_closure_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.app_role;
  v_actor_unit uuid;
  v_follow_up public.follow_ups;
  v_status public.follow_up_status;
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

  if not exists (
    select 1
    from public.appointments a
    join public.patients p on p.id = a.patient_id
    where a.id = v_follow_up.appointment_id
      and p.service_unit_id = v_actor_unit
  ) then
    raise exception 'follow_up_forbidden' using errcode = '42501';
  end if;

  if v_follow_up.version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'P0004';
  end if;

  v_status := case
    when p_status in ('pending','assigned','contacted','rescheduled','returned','closed')
      then p_status::public.follow_up_status
    else v_follow_up.status
  end;
  v_priority := case when p_priority in ('normal','high','urgent') then p_priority else v_follow_up.priority end;

  update public.follow_ups
  set status = v_status,
      priority = v_priority,
      missed_reason = p_missed_reason,
      reason_note = p_reason_note,
      counselling_note = p_counselling_note,
      closure_reason = p_closure_reason,
      version = version + 1,
      updated_at = now()
  where id = p_follow_up_id;

  insert into public.audit_logs (actor_id, actor_role, service_unit_id, action, entity_type, entity_id, before_data, after_data)
  values (
    p_actor_id, v_actor_role, v_actor_unit, 'follow_up_updated', 'follow_up', p_follow_up_id,
    jsonb_build_object('version', p_expected_version, 'status', v_follow_up.status, 'priority', v_follow_up.priority),
    jsonb_build_object('status', v_status, 'priority', v_priority, 'missed_reason', p_missed_reason, 'closure_reason', p_closure_reason)
  );

  return jsonb_build_object(
    'follow_up_id', p_follow_up_id,
    'version', v_follow_up.version + 1,
    'status', v_status,
    'priority', v_priority
  );
end;
$$;

revoke all on function public.update_follow_up(uuid, integer, uuid, text, text, text, text, text, text) from public;
grant execute on function public.update_follow_up(uuid, integer, uuid, text, text, text, text, text, text) to service_role;

create or replace function public.add_follow_up_activity(
  p_follow_up_id uuid,
  p_activity_type text,
  p_note text,
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
  v_activity_id uuid;
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

  insert into public.follow_up_activities (follow_up_id, activity_type, note, performed_by)
  values (p_follow_up_id, p_activity_type, p_note, p_actor_id)
  returning id into v_activity_id;

  return jsonb_build_object('activity_id', v_activity_id, 'follow_up_id', p_follow_up_id);
end;
$$;

revoke all on function public.add_follow_up_activity(uuid, text, text, uuid) from public;
grant execute on function public.add_follow_up_activity(uuid, text, text, uuid) to service_role;
