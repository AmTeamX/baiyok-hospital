-- STEP 7 — ยืนยันกลับมารับบริการและปิดเคส (RET-01..03).
-- Apply after 010_volunteer_workflows.sql. Never edit a migration already applied in production.
--
-- Provides the unified "attendance closes the follow-up" service and the pieces that
-- call it from three sources:
--   1. close_follow_up_on_attendance()  — shared close (RET-03).
--   2. check_in_appointment()           — secure QR check-in (RET-02).
--   3. commit_service_result_batch()    — service-result reconciliation (RET-01).
--   4. confirm_return_manually()        — nurse manual confirmation (RET-03).
-- Also adds service_result_rows (reconciliation review queue) and a 'cancelled'
-- notification state so pending reminders can be dropped when a case closes.
--
-- Rollback / forward-fix note: all functions are `create or replace function`; drop them
-- by full signature. `drop table if exists public.service_result_rows;` and re-assert the
-- notification_logs status check without 'cancelled' to fully revert.

-- Allow cancelling notifications that are no longer needed after a case closes.
alter table public.notification_logs drop constraint if exists notification_logs_status_check;
alter table public.notification_logs add constraint notification_logs_status_check
  check (status in ('pending', 'processing', 'sent', 'failed', 'dead_letter', 'unlinked', 'cancelled'));

-- Review queue for service-result reconciliation (matched/unmatched/ambiguous).
create table if not exists public.service_result_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  hn text not null,
  service_date date not null,
  clinic text not null,
  service_result text not null,
  external_reference text,
  status text not null default 'pending'
    check (status in ('pending', 'matched', 'unmatched', 'ambiguous')),
  matched_appointment_id uuid references public.appointments(id),
  created_at timestamptz not null default now()
);
create index if not exists service_result_rows_batch_idx on public.service_result_rows(batch_id);
create index if not exists service_result_rows_review_idx on public.service_result_rows(status) where status in ('unmatched', 'ambiguous');

alter table public.service_result_rows enable row level security;

-- ---------------------------------------------------------------------------
-- Shared close: an appointment whose attendance is confirmed marks any active
-- follow-up as returned, appends an activity, cancels stale notifications and
-- writes an audit event. Idempotent — no active follow-up means a no-op.
-- ---------------------------------------------------------------------------
create or replace function public.close_follow_up_on_attendance(
  p_appointment_id uuid,
  p_source text,
  p_actor_id uuid,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_follow_up public.follow_ups;
  v_unit uuid;
  v_source text;
begin
  v_source := case when p_source in ('import', 'check_in', 'manual') then p_source else 'manual' end;

  select f.* into v_follow_up
  from public.follow_ups f
  where f.appointment_id = p_appointment_id
    and f.status not in ('returned', 'closed')
  order by f.created_at desc
  limit 1;

  if v_follow_up.id is null then
    return jsonb_build_object('closed', false, 'appointment_id', p_appointment_id);
  end if;

  select p.service_unit_id into v_unit
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  where a.id = p_appointment_id;

  update public.follow_ups
  set status = 'returned',
      returned_confirmed_at = now(),
      closure_reason = 'returned_by_' || v_source,
      version = version + 1,
      updated_at = now()
  where id = v_follow_up.id;

  insert into public.follow_up_activities (follow_up_id, activity_type, note, performed_by)
  values (v_follow_up.id, 'returned_by_' || v_source, p_note, p_actor_id);

  update public.notification_logs
  set status = 'cancelled'
  where follow_up_id = v_follow_up.id
    and status in ('pending', 'failed');

  insert into public.audit_logs (actor_id, actor_role, service_unit_id, action, entity_type, entity_id, before_data, after_data)
  select
    p_actor_id,
    (select pr.role from public.profiles pr where pr.id = p_actor_id),
    v_unit,
    'follow_up_returned', 'follow_up', v_follow_up.id,
    jsonb_build_object('status', v_follow_up.status),
    jsonb_build_object('status', 'returned', 'source', v_source);

  return jsonb_build_object('closed', true, 'follow_up_id', v_follow_up.id);
end;
$$;

revoke all on function public.close_follow_up_on_attendance(uuid, text, uuid, text) from public;
grant execute on function public.close_follow_up_on_attendance(uuid, text, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Idempotent QR check-in: verifies the appointment is check-in-able, records
-- the check-in, marks attendance and closes the follow-up in one transaction.
-- ---------------------------------------------------------------------------
create or replace function public.check_in_appointment(
  p_appointment_id uuid,
  p_nonce text,
  p_channel text default 'qr'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments;
  v_unit uuid;
  v_check_in_id uuid;
  v_already boolean := false;
begin
  select * into v_appointment from public.appointments where id = p_appointment_id;
  if not found then
    raise exception 'appointment_not_found' using errcode = 'P0002';
  end if;

  if v_appointment.status = 'cancelled' then
    raise exception 'appointment_cancelled' using errcode = 'P0006';
  end if;

  select p.service_unit_id into v_unit
  from public.patients p
  where p.id = v_appointment.patient_id;

  insert into public.check_ins (appointment_id, checked_in_at, channel)
  values (p_appointment_id, now(), p_channel)
  on conflict (appointment_id) do nothing
  returning id into v_check_in_id;

  v_already := v_check_in_id is null;

  update public.appointments
  set status = 'attended',
      attended_at = coalesce(attended_at, now()),
      attendance_source = 'check_in',
      updated_at = now()
  where id = p_appointment_id
    and status <> 'attended';

  perform public.close_follow_up_on_attendance(p_appointment_id, 'check_in', null, 'เช็กอินเข้ารับบริการ');

  insert into public.audit_logs (service_unit_id, action, entity_type, entity_id, after_data)
  values (
    v_unit, 'check_in_recorded', 'appointment', p_appointment_id,
    jsonb_build_object('nonce', p_nonce, 'channel', p_channel, 'already', v_already)
  );

  return jsonb_build_object('appointment_id', p_appointment_id, 'already', v_already);
end;
$$;

revoke all on function public.check_in_appointment(uuid, text, text) from public;
grant execute on function public.check_in_appointment(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Nurse manual confirmation that a patient returned (RET-03 manual source).
-- Optimistic-locked; also marks the appointment attended.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_return_manually(
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
  v_actor_role public.app_role;
  v_actor_unit uuid;
  v_follow_up public.follow_ups;
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

  if v_follow_up.status in ('returned', 'closed') then
    raise exception 'follow_up_not_open' using errcode = 'P0006';
  end if;

  if v_follow_up.version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'P0004';
  end if;

  update public.appointments
  set status = 'attended',
      attended_at = coalesce(attended_at, now()),
      attendance_source = 'manual',
      updated_at = now()
  where id = v_follow_up.appointment_id;

  perform public.close_follow_up_on_attendance(v_follow_up.appointment_id, 'manual', p_actor_id, p_note);

  return jsonb_build_object(
    'follow_up_id', p_follow_up_id,
    'version', v_follow_up.version + 1,
    'status', 'returned'
  );
end;
$$;

revoke all on function public.confirm_return_manually(uuid, uuid, text, integer) from public;
grant execute on function public.confirm_return_manually(uuid, uuid, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Service-result reconciliation (RET-01). Commits a service_results batch,
-- stages each row into the review queue, matches it (external_reference first,
-- then HN + clinic + appointment date within tolerance), and for an unambiguous
-- match marks the appointment attended and closes the follow-up. Unmatched and
-- ambiguous rows stay in the review queue instead of guessing.
-- ---------------------------------------------------------------------------
create or replace function public.commit_service_result_batch(
  p_filename text,
  p_checksum text,
  p_created_by uuid,
  p_rows jsonb,
  p_tolerance_days integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.import_batches;
  v_item record;
  v_row_id uuid;
  v_match_count integer;
  v_appointment_id uuid;
  v_status text;
  v_matched integer := 0;
  v_unmatched integer := 0;
  v_ambiguous integer := 0;
begin
  insert into public.import_batches (kind, filename, checksum, status, total_rows, valid_rows, invalid_rows, created_by)
  values ('service_results', p_filename, p_checksum, 'preview', jsonb_array_length(p_rows), jsonb_array_length(p_rows), 0, p_created_by)
  on conflict (checksum, kind) do update set filename = excluded.filename
  returning * into v_batch;

  if v_batch.status = 'committed' then
    return jsonb_build_object('batch_id', v_batch.id, 'idempotent', true, 'rows', v_batch.valid_rows);
  end if;

  for v_item in
    select * from jsonb_to_recordset(p_rows) as x(
      hn text, service_date date, clinic text, service_result text, external_reference text
    )
  loop
    insert into public.service_result_rows (batch_id, hn, service_date, clinic, service_result, external_reference)
    values (v_batch.id, v_item.hn, v_item.service_date, v_item.clinic, v_item.service_result, nullif(v_item.external_reference, ''))
    returning id into v_row_id;

    v_appointment_id := null;
    v_match_count := 0;

    if nullif(v_item.external_reference, '') is not null then
      select count(*) into v_match_count
      from public.appointments a
      join public.patients p on p.id = a.patient_id
      where p.hn = v_item.hn and a.external_reference = v_item.external_reference;

      if v_match_count = 1 then
        select a.id into v_appointment_id
        from public.appointments a
        join public.patients p on p.id = a.patient_id
        where p.hn = v_item.hn and a.external_reference = v_item.external_reference;
      end if;
    else
      select count(*) into v_match_count
      from public.appointments a
      join public.patients p on p.id = a.patient_id
      where p.hn = v_item.hn
        and a.clinic = v_item.clinic
        and a.appointment_at >= ((v_item.service_date - p_tolerance_days)::text || 'T00:00:00+07:00')::timestamptz
        and a.appointment_at < ((v_item.service_date + p_tolerance_days + 1)::text || 'T00:00:00+07:00')::timestamptz;

      if v_match_count = 1 then
        select a.id into v_appointment_id
        from public.appointments a
        join public.patients p on p.id = a.patient_id
        where p.hn = v_item.hn
          and a.clinic = v_item.clinic
          and a.appointment_at >= ((v_item.service_date - p_tolerance_days)::text || 'T00:00:00+07:00')::timestamptz
          and a.appointment_at < ((v_item.service_date + p_tolerance_days + 1)::text || 'T00:00:00+07:00')::timestamptz;
      end if;
    end if;

    if v_match_count = 1 then
      v_status := 'matched';
      v_matched := v_matched + 1;
      update public.appointments
      set status = 'attended', attended_at = coalesce(attended_at, now()), attendance_source = 'import', updated_at = now()
      where id = v_appointment_id;
      perform public.close_follow_up_on_attendance(v_appointment_id, 'import', p_created_by, 'ยืนยันจากผลบริการ');
    elsif v_match_count = 0 then
      v_status := 'unmatched';
      v_unmatched := v_unmatched + 1;
    else
      v_status := 'ambiguous';
      v_ambiguous := v_ambiguous + 1;
    end if;

    update public.service_result_rows
    set status = v_status, matched_appointment_id = case when v_status = 'matched' then v_appointment_id else null end
    where id = v_row_id;
  end loop;

  update public.import_batches
  set status = 'committed', total_rows = jsonb_array_length(p_rows),
      valid_rows = jsonb_array_length(p_rows), invalid_rows = 0, committed_at = now()
  where id = v_batch.id;

  insert into public.audit_logs (actor_id, actor_role, service_unit_id, action, entity_type, entity_id, after_data)
  select p_created_by, role, service_unit_id, 'service_results_reconciled', 'import_batch', v_batch.id,
         jsonb_build_object('matched', v_matched, 'unmatched', v_unmatched, 'ambiguous', v_ambiguous, 'checksum', p_checksum)
  from public.profiles where id = p_created_by;

  return jsonb_build_object(
    'batch_id', v_batch.id,
    'idempotent', false,
    'matched', v_matched,
    'unmatched', v_unmatched,
    'ambiguous', v_ambiguous
  );
exception when others then
  if v_batch.id is not null then
    update public.import_batches set status = 'failed' where id = v_batch.id;
  end if;
  raise;
end;
$$;

revoke all on function public.commit_service_result_batch(text, text, uuid, jsonb, integer) from public;
grant execute on function public.commit_service_result_batch(text, text, uuid, jsonb, integer) to service_role;
