-- Send one reminder per still-unanswered assignment per Bangkok calendar day.
-- The 08:00 job enqueues and dispatches these messages in the same invocation.
-- Older assignment RPCs use ON CONFLICT(idempotency_key) without an index
-- predicate. A full unique index supports that form while still allowing NULLs.
create unique index if not exists notification_logs_idempotency_key_full_idx
on public.notification_logs(idempotency_key);

create or replace function public.enqueue_sla_reminders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Asia/Bangkok')::date;
  v_total integer;
begin
  insert into public.notification_logs (
    appointment_id, follow_up_id, recipient_profile_id, kind, channel, status,
    idempotency_key, attempt_count, next_attempt_at
  )
  select f.appointment_id, f.id, f.assigned_volunteer_id,
         'follow_up_sla_reminder', 'line', 'pending',
         'follow_up_sla_reminder:' || f.id::text || ':' || f.assigned_volunteer_id::text || ':' || v_day::text,
         0, now()
  from public.follow_ups f
  join public.appointments a on a.id = f.appointment_id
  join public.patients p on p.id = a.patient_id
  join public.service_units u on u.id = p.service_unit_id and u.active = true
  join public.profiles v on v.id = f.assigned_volunteer_id and v.active = true and v.role = 'volunteer'
  where f.status = 'assigned'
    and f.assigned_at < (v_day::timestamp at time zone 'Asia/Bangkok')
    and exists (
      select 1 from public.line_account_links l
      where l.profile_id = f.assigned_volunteer_id and l.role = 'volunteer' and l.status = 'active'
    )
  on conflict (idempotency_key) where idempotency_key is not null do nothing;
  get diagnostics v_total = row_count;
  return jsonb_build_object('enqueued', v_total, 'at', now());
end;
$$;
revoke all on function public.enqueue_sla_reminders() from public;
grant execute on function public.enqueue_sla_reminders() to service_role;

-- Stop queued notices once the task is finished, answered or reassigned.
create or replace function public.cancel_stale_volunteer_notices()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_logs
  set status = 'cancelled', next_attempt_at = null
  where follow_up_id = new.id and status in ('pending', 'failed', 'unlinked')
    and (
      new.status in ('rescheduled', 'returned', 'closed')
      or recipient_profile_id is distinct from new.assigned_volunteer_id
      or (kind = 'follow_up_sla_reminder' and new.status <> 'assigned')
    );
  return new;
end;
$$;
create trigger follow_ups_cancel_stale_notices
after update of status, assigned_volunteer_id on public.follow_ups
for each row execute function public.cancel_stale_volunteer_notices();
