-- Run with pgTAP enabled in a disposable Supabase test database (like mark_missed.sql).
-- Verifies record_volunteer_result() and escalate_follow_up(): assignment scoping,
-- inactive-volunteer denial, optimistic locking, and the resulting state transitions.
begin;
select plan(9);

-- Fixed test data with unique HN and full_name so this stays isolated on a reset DB.
insert into public.service_units (name, timezone, sla_hours)
values ('หน่วยทดสอบ อสม.', 'Asia/Bangkok', 48)
on conflict (name) do nothing;

insert into public.patients (hn, full_name, service_unit_id)
values ('VHV-TEST-001', 'ผู้ป่วยทดสอบอสม.', (select id from public.service_units where name = 'หน่วยทดสอบ อสม.'))
on conflict (hn) do nothing;

insert into public.appointments (patient_id, appointment_at, clinic, status)
select p.id, now() - interval '24 hours', 'คลินิกความดัน', 'missed'
from public.patients p where p.hn = 'VHV-TEST-001';

insert into public.follow_ups (appointment_id, status, priority, assigned_volunteer_id, version)
select a.id, 'assigned', 'normal', null, 1
from public.appointments a join public.patients p on p.id = a.patient_id where p.hn = 'VHV-TEST-001';

-- Profiles can only reference auth.users(id); create two synthetic auth users.
insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-0000000000a1', 'vhv-a@example.test'),
  ('00000000-0000-4000-8000-0000000000a2', 'vhv-b@example.test'),
  ('00000000-0000-4000-8000-0000000000a3', 'vhv-inactive@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, service_unit_id, active)
select u.id, name, 'volunteer'::public.app_role, su.id, true
from (values
  ('00000000-0000-4000-8000-0000000000a1', 'อสม. ก'),
  ('00000000-0000-4000-8000-0000000000a2', 'อสม. ข'),
  ('00000000-0000-4000-8000-0000000000a3', 'อสม. หยุด')
) as t(id, name), auth.users u, public.service_units su
where u.id = t.id and su.name = 'หน่วยทดสอบ อสม.'
on conflict (id) do nothing;

update public.profiles set active = false where id = '00000000-0000-4000-8000-0000000000a3';

-- Assign the follow-up to อสม. ก.
update public.follow_ups f
set assigned_volunteer_id = '00000000-0000-4000-8000-0000000000a1'
from public.appointments a join public.patients p on p.id = a.patient_id
where f.appointment_id = a.id and p.hn = 'VHV-TEST-001';

-- 1) a volunteer other than the assignee is denied.
select throws_ok(
  $$ select public.record_volunteer_result(
       (select f.id from public.follow_ups f join public.appointments a on a.id = f.appointment_id join public.patients p on p.id = a.patient_id where p.hn = 'VHV-TEST-001'),
       '00000000-0000-4000-8000-0000000000a2', 'contacted_will_come', null, 'phone', 1) $$,
  '42501',
  'a non-assigned volunteer is denied'
);

-- 2) an inactive volunteer is denied.
select throws_ok(
  $$ select public.record_volunteer_result(
       (select f.id from public.follow_ups f join public.appointments a on a.id = f.appointment_id join public.patients p on p.id = a.patient_id where p.hn = 'VHV-TEST-001'),
       '00000000-0000-4000-8000-0000000000a3', 'contacted_will_come', null, 'phone', 1) $$,
  '42501',
  'an inactive volunteer is denied'
);

-- 3) a wrong version is rejected.
select throws_ok(
  $$ select public.record_volunteer_result(
       (select f.id from public.follow_ups f join public.appointments a on a.id = f.appointment_id join public.patients p on p.id = a.patient_id where p.hn = 'VHV-TEST-001'),
       '00000000-0000-4000-8000-0000000000a1', 'contacted_will_come', null, 'phone', 999) $$,
  'P0004',
  'a stale version is rejected'
);

-- 4) happy path: assigned volunteer records a result.
select is(
  (select (public.record_volunteer_result(
       (select f.id from public.follow_ups f join public.appointments a on a.id = f.appointment_id join public.patients p on p.id = a.patient_id where p.hn = 'VHV-TEST-001'),
       '00000000-0000-4000-8000-0000000000a1', 'contacted_will_come', 'สะดวกมาวันพฤหัส', 'phone', 1) ->> 'status')),
  'contacted',
  'recording a result marks the follow-up contacted'
);

select is(
  (select f.status from public.follow_ups f join public.appointments a on a.id = f.appointment_id join public.patients p on p.id = a.patient_id where p.hn = 'VHV-TEST-001'),
  'contacted',
  'follow-up status is now contacted'
);

select is(
  (select f.version from public.follow_ups f join public.appointments a on a.id = f.appointment_id join public.patients p on p.id = a.patient_id where p.hn = 'VHV-TEST-001'),
  2,
  'version was incremented'
);

select is(
  (select count(*)::int from public.follow_up_activities ac join public.follow_ups f on f.id = ac.follow_up_id join public.appointments a on a.id = f.appointment_id join public.patients p on p.id = a.patient_id where p.hn = 'VHV-TEST-001' and ac.activity_type = 'contacted_will_come'),
  1,
  'an append-only activity was recorded'
);

-- 7) escalation raises priority to urgent.
select is(
  (select (public.escalate_follow_up(
       (select f.id from public.follow_ups f join public.appointments a on a.id = f.appointment_id join public.patients p on p.id = a.patient_id where p.hn = 'VHV-TEST-001'),
       '00000000-0000-4000-8000-0000000000a1', 'มีอาการหน้ามืด', 2) ->> 'priority')),
  'urgent',
  'escalation raises priority to urgent'
);

-- 8) escalation activity exists.
select is(
  (select count(*)::int from public.follow_up_activities ac join public.follow_ups f on f.id = ac.follow_up_id join public.appointments a on a.id = f.appointment_id join public.patients p on p.id = a.patient_id where p.hn = 'VHV-TEST-001' and ac.activity_type = 'escalation_requested'),
  1,
  'an escalation activity was recorded'
);

-- 9) recording on a closed follow-up is rejected.
update public.follow_ups f
set status = 'closed', closure_reason = 'ปิดโดยทดสอบ'
from public.appointments a join public.patients p on p.id = a.patient_id
where f.appointment_id = a.id and p.hn = 'VHV-TEST-001';

select throws_ok(
  $$ select public.record_volunteer_result(
       (select f.id from public.follow_ups f join public.appointments a on a.id = f.appointment_id join public.patients p on p.id = a.patient_id where p.hn = 'VHV-TEST-001'),
       '00000000-0000-4000-8000-0000000000a1', 'contacted_will_come', null, 'phone', 3) $$,
  'P0006',
  'a closed follow-up cannot receive a new result'
);

select * from finish();
rollback;
