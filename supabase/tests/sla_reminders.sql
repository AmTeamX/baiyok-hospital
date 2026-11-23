-- Run with pgTAP enabled in a disposable Supabase test database.
-- Verifies enqueue_sla_reminders(): only assigned + past-SLA follow-ups are
-- reminded, and re-running the job does not create a duplicate reminder.
begin;
select plan(4);

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

insert into public.appointments (patient_id, appointment_at, clinic, status)
select p.id, now() - interval '72 hours', 'คลินิกความดัน', 'missed'
from public.patients p where p.hn = 'SLA-TEST-001';

-- Assigned, past SLA (assigned 72h ago) -> should be reminded.
insert into public.follow_ups (appointment_id, status, priority, assigned_volunteer_id, assigned_at, version)
select a.id, 'assigned', 'normal', '00000000-0000-4000-8000-0000000000b1', now() - interval '72 hours', 1
from public.appointments a join public.patients p on p.id = a.patient_id where p.hn = 'SLA-TEST-001';

-- Assigned, within SLA (assigned 1h ago) -> should NOT be reminded.
insert into public.appointments (patient_id, appointment_at, clinic, status)
select p.id, now() - interval '1 hour', 'คลินิกเบาหวาน', 'missed'
from public.patients p where p.hn = 'SLA-TEST-001';

insert into public.follow_ups (appointment_id, status, priority, assigned_volunteer_id, assigned_at, version)
select a.id, 'assigned', 'normal', '00000000-0000-4000-8000-0000000000b1', now() - interval '1 hour', 1
from public.appointments a join public.patients p on p.id = a.patient_id where p.hn = 'SLA-TEST-001' and a.clinic = 'คลินิกเบาหวาน';

select is(
  (select (public.enqueue_sla_reminders() ->> 'enqueued')::int),
  1,
  'only the past-SLA assigned follow-up is reminded'
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

select * from finish();
rollback;
