-- Run with pgTAP enabled in a disposable Supabase test database.
-- Verifies the return-closure RPCs: check-in, close-on-attendance, manual
-- confirmation and service-result reconciliation (correct match + no wrong close).
begin;
select plan(11);

insert into public.service_units (name, timezone, sla_hours)
values ('หน่วยทดสอบปิดเคส', 'Asia/Bangkok', 48)
on conflict (name) do nothing;

insert into public.patients (hn, full_name, service_unit_id)
values ('RET-TEST-001', 'ผู้ป่วยทดสอบปิดเคส', (select id from public.service_units where name = 'หน่วยทดสอบปิดเคส'))
on conflict (hn) do nothing;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000c1', 'nurse-ret@example.test'),
  ('00000000-0000-4000-8000-0000000000c2', 'vhv-ret@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, service_unit_id, active)
select t.id, t.name, t.role::public.app_role, (select id from public.service_units where name = 'หน่วยทดสอบปิดเคส'), true
from (values
  ('00000000-0000-4000-8000-0000000000c1', 'พยาบาล ทดสอบ', 'nurse'),
  ('00000000-0000-4000-8000-0000000000c2', 'อสม. ทดสอบ', 'volunteer')
) as t(id, name, role)
on conflict (id) do nothing;

-- A missed appointment with an assigned follow-up and a pending notification.
insert into public.appointments (patient_id, appointment_at, clinic, status)
select p.id, now() - interval '24 hours', 'คลินิกความดัน', 'missed'
from public.patients p where p.hn = 'RET-TEST-001';

insert into public.follow_ups (appointment_id, status, priority, assigned_volunteer_id, version)
select a.id, 'assigned', 'normal', '00000000-0000-4000-8000-0000000000c2', 1
from public.appointments a join public.patients p on p.id = a.patient_id where p.hn = 'RET-TEST-001';

insert into public.notification_logs (appointment_id, follow_up_id, recipient_profile_id, kind, channel, status, idempotency_key, attempt_count, next_attempt_at)
select a.id, f.id, f.assigned_volunteer_id, 'follow_up_assigned', 'line', 'pending', 'ret:test:' || f.id, 0, now()
from public.appointments a join public.follow_ups f on f.appointment_id = a.id join public.patients p on p.id = a.patient_id where p.hn = 'RET-TEST-001';

-- 1) check-in marks attendance and closes the follow-up.
select is(
  (select (public.check_in_appointment(
       (select a.id from public.appointments a join public.patients p on p.id = a.patient_id where p.hn = 'RET-TEST-001'),
       'nonce-1', 'qr') ->> 'already')::boolean),
  false,
  'check-in is a new (non-idempotent) event'
);

select is(
  (select a.status from public.appointments a join public.patients p on p.id = a.patient_id where p.hn = 'RET-TEST-001'),
  'attended',
  'check-in marks the appointment attended'
);

select is(
  (select f.status from public.follow_ups f join public.appointments a on a.id = f.appointment_id join public.patients p on p.id = a.patient_id where p.hn = 'RET-TEST-001'),
  'returned',
  'check-in returns the follow-up'
);

-- 2) pending notifications are cancelled.
select is(
  (select n.status from public.notification_logs n join public.follow_ups f on f.id = n.follow_up_id join public.appointments a on a.id = f.appointment_id join public.patients p on p.id = a.patient_id where p.hn = 'RET-TEST-001'),
  'cancelled',
  'the pending notification is cancelled'
);

-- 3) re-check-in is idempotent.
select is(
  (select (public.check_in_appointment(
       (select a.id from public.appointments a join public.patients p on p.id = a.patient_id where p.hn = 'RET-TEST-001'),
       'nonce-2', 'qr') ->> 'already')::boolean),
  true,
  'a second check-in is idempotent'
);

-- 4) a cancelled appointment is rejected.
insert into public.appointments (patient_id, appointment_at, clinic, status)
select p.id, now() - interval '24 hours', 'คลินิกเบาหวาน', 'cancelled'
from public.patients p where p.hn = 'RET-TEST-001';

select throws_ok(
  $$ select public.check_in_appointment(
       (select a.id from public.appointments a join public.patients p on p.id = a.patient_id where p.hn = 'RET-TEST-001' and a.clinic = 'คลินิกเบาหวาน'),
       'nonce-3', 'qr') $$,
  'P0006',
  'a cancelled appointment cannot be checked in'
);

-- 5) service-result reconciliation: an ambiguous match is NOT closed.
-- Two same-day appointments for the same patient/clinic -> ambiguous.
insert into public.appointments (patient_id, appointment_at, clinic, status)
select p.id, (now() + interval '1 day')::date::timestamp + interval '08:00', 'คลินิกความดัน', 'scheduled'
from public.patients p where p.hn = 'RET-TEST-001';

insert into public.appointments (patient_id, appointment_at, clinic, status)
select p.id, (now() + interval '1 day')::date::timestamp + interval '13:00', 'คลินิกความดัน', 'scheduled'
from public.patients p where p.hn = 'RET-TEST-001';

select is(
  (select (public.commit_service_result_batch(
       'ambig.csv', 'checksum-ambig', '00000000-0000-4000-8000-0000000000c1',
       jsonb_build_array(jsonb_build_object(
         'hn', 'RET-TEST-001', 'service_date', (now() + interval '1 day')::date, 'clinic', 'คลินิกความดัน', 'service_result', 'มาแล้ว')),
       0) ->> 'ambiguous')::int),
  1,
  'an ambiguous service result is routed to review, not closed'
);

-- 6) manual confirmation rejects a stale version.
insert into public.appointments (patient_id, appointment_at, clinic, status)
select p.id, now() - interval '48 hours', 'คลินิกเบาหวาน', 'missed'
from public.patients p where p.hn = 'RET-TEST-001';

insert into public.follow_ups (appointment_id, status, priority, assigned_volunteer_id, version)
select a.id, 'assigned', 'normal', '00000000-0000-4000-8000-0000000000c2', 1
from public.appointments a join public.patients p on p.id = a.patient_id where p.hn = 'RET-TEST-001' and a.clinic = 'คลินิกเบาหวาน';

select throws_ok(
  $$ select public.confirm_return_manually(
       (select f.id from public.follow_ups f join public.appointments a on a.id = f.appointment_id join public.patients p on p.id = a.patient_id where p.hn = 'RET-TEST-001' and a.clinic = 'คลินิกเบาหวาน'),
       '00000000-0000-4000-8000-0000000000c1', 'ยืนยัน', 999) $$,
  'P0004',
  'manual confirmation rejects a stale version'
);

-- 7) manual confirmation with the correct version closes the case.
select is(
  (select (public.confirm_return_manually(
       (select f.id from public.follow_ups f join public.appointments a on a.id = f.appointment_id join public.patients p on p.id = a.patient_id where p.hn = 'RET-TEST-001' and a.clinic = 'คลินิกเบาหวาน'),
       '00000000-0000-4000-8000-0000000000c1', 'ยืนยัน', 1) ->> 'status')),
  'returned',
  'manual confirmation returns the follow-up'
);

select is(
  (select a.status from public.appointments a join public.patients p on p.id = a.patient_id where p.hn = 'RET-TEST-001' and a.clinic = 'คลินิกเบาหวาน'),
  'attended',
  'manual confirmation marks the appointment attended'
);

-- 8) the audit log records the closure.
select is(
  (select count(*)::int from public.audit_logs al where al.action in ('check_in_recorded', 'follow_up_returned')),
  3,
  'closure and check-in events are audited'
);

select * from finish();
rollback;
