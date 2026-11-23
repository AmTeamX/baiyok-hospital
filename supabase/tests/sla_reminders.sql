-- Run with pgTAP enabled in a disposable Supabase test database.
-- Verifies the once-per-Bangkok-day reminder workflow after migration 018.
begin;
select plan(8);

insert into public.service_units (name, timezone, sla_hours)
values ('หน่วยทดสอบ SLA', 'Asia/Bangkok', 48)
on conflict (name) do nothing;

insert into public.patients (hn, full_name, service_unit_id)
values ('SLA-TEST-001', 'ผู้ป่วยทดสอบ SLA', (select id from public.service_units where name = 'หน่วยทดสอบ SLA'))
on conflict (hn) do nothing;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000b1', 'vhv-sla@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, service_unit_id, active)
select '00000000-0000-4000-8000-0000000000b1', 'อสม. SLA', 'volunteer'::public.app_role,
       (select id from public.service_units where name = 'หน่วยทดสอบ SLA'), true
on conflict (id) do nothing;

insert into public.line_accounts (line_user_id) values ('U-SLA-TEST-001') on conflict (line_user_id) do nothing;
insert into public.line_account_links (line_account_id, profile_id, role, status)
select id, '00000000-0000-4000-8000-0000000000b1', 'volunteer', 'active'
from public.line_accounts where line_user_id = 'U-SLA-TEST-001';

insert into public.appointments (patient_id, appointment_at, clinic, status)
select p.id, now() - interval '72 hours', 'คลินิกความดัน', 'missed'
from public.patients p where p.hn = 'SLA-TEST-001';

-- Unanswered assignment from a previous day -> should be reminded.
insert into public.follow_ups (appointment_id, status, priority, assigned_volunteer_id, assigned_at, version)
select a.id, 'assigned', 'normal', '00000000-0000-4000-8000-0000000000b1', now() - interval '72 hours', 1
from public.appointments a join public.patients p on p.id = a.patient_id where p.hn = 'SLA-TEST-001';

-- Assigned today -> already received its immediate notice; do not remind yet.
insert into public.appointments (patient_id, appointment_at, clinic, status)
select p.id, now() - interval '1 hour', 'คลินิกเบาหวาน', 'missed'
from public.patients p where p.hn = 'SLA-TEST-001';

insert into public.follow_ups (appointment_id, status, priority, assigned_volunteer_id, assigned_at, version)
select a.id, 'assigned', 'normal', '00000000-0000-4000-8000-0000000000b1', date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok', 1
from public.appointments a join public.patients p on p.id = a.patient_id where p.hn = 'SLA-TEST-001' and a.clinic = 'คลินิกเบาหวาน';

select is(
  (select (public.enqueue_sla_reminders() ->> 'enqueued')::int),
  1,
  'only unanswered assignments from a previous Bangkok day are reminded'
);

select is(
  (select count(*)::int from public.notification_logs n join public.follow_ups f on f.id = n.follow_up_id join public.appointments a on a.id = f.appointment_id join public.patients p on p.id = a.patient_id where p.hn = 'SLA-TEST-001' and n.kind = 'follow_up_sla_reminder'),
  1,
  'exactly one SLA reminder notification is created'
);

-- Idempotency: a second run must not enqueue another reminder.
select is(
  (select (public.enqueue_sla_reminders() ->> 'enqueued')::int),
  0,
  're-running the job enqueues nothing new'
);

select is(
  (select count(*)::int from public.notification_logs n join public.follow_ups f on f.id = n.follow_up_id join public.appointments a on a.id = f.appointment_id join public.patients p on p.id = a.patient_id where p.hn = 'SLA-TEST-001' and n.kind = 'follow_up_sla_reminder'),
  1,
  'the reminder count is unchanged after re-running'
);

-- Simulate an earlier day's reminder by changing only the fixture's key.
update public.notification_logs n set idempotency_key = 'previous-day:' || n.id::text, status = 'sent'
from public.follow_ups f, public.appointments a, public.patients p
where n.follow_up_id = f.id and f.appointment_id = a.id and a.patient_id = p.id
  and p.hn = 'SLA-TEST-001' and n.kind = 'follow_up_sla_reminder';
select is((public.enqueue_sla_reminders() ->> 'enqueued')::int, 1, 'a previous day reminder does not suppress today reminder');
select is((public.enqueue_sla_reminders() ->> 'enqueued')::int, 0, 'today reminder is still idempotent');
update public.follow_ups f set status = 'contacted'
from public.appointments a, public.patients p
where f.appointment_id = a.id and a.patient_id = p.id and p.hn = 'SLA-TEST-001';
select is((select count(*)::int from public.notification_logs n join public.follow_ups f on f.id = n.follow_up_id join public.appointments a on a.id = f.appointment_id join public.patients p on p.id = a.patient_id where p.hn = 'SLA-TEST-001' and n.kind = 'follow_up_sla_reminder' and n.status = 'pending'), 0, 'recording a result cancels queued reminders');
select is((public.enqueue_sla_reminders() ->> 'enqueued')::int, 0, 'answered tasks are not reminded again');
select * from finish();
rollback;
