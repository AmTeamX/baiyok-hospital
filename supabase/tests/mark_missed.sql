-- Run with pgTAP enabled in a disposable Supabase test database (like rls_policies.sql).
-- Verifies mark_missed_appointments(): happy path, idempotency and exclusion rules.
begin;
select plan(6);

-- Fixed test data. Use a unique HN so this stays isolated on a reset DB.
insert into public.patients (hn, full_name, service_unit_id)
values ('MISS-TEST-001', 'ผู้ป่วยทดสอบขาดนัด', (select id from public.service_units where name = 'รพ.สต. สระโคล่' limit 1))
on conflict (hn) do nothing;

-- 1) scheduled and past cutoff -> should be marked missed + follow-up created.
insert into public.appointments (patient_id, appointment_at, clinic, status)
select p.id, now() - interval '48 hours', 'คลินิกความดัน', 'scheduled'
from public.patients p where p.hn = 'MISS-TEST-001';

-- 2) scheduled but within cutoff -> should stay scheduled.
insert into public.appointments (patient_id, appointment_at, clinic, status)
select p.id, now() - interval '1 hour', 'คลินิกความดัน', 'scheduled'
from public.patients p where p.hn = 'MISS-TEST-001';

-- 3) attended (already has result) -> should stay attended.
insert into public.appointments (patient_id, appointment_at, clinic, status, attended_at)
select p.id, now() - interval '48 hours', 'คลินิกเบาหวาน', 'attended', now()
from public.patients p where p.hn = 'MISS-TEST-001';

-- 4) cancelled -> should stay cancelled.
insert into public.appointments (patient_id, appointment_at, clinic, status)
select p.id, now() - interval '48 hours', 'คลินิกอื่น', 'cancelled'
from public.patients p where p.hn = 'MISS-TEST-001';

select is(
  (select count(*)::int from public.appointments a join public.patients p on p.id = a.patient_id where p.hn = 'MISS-TEST-001' and a.clinic = 'คลินิกความดัน' and a.status = 'scheduled'),
  2,
  'precondition: two scheduled test appointments exist'
);

select mark_missed_appointments();

select is(
  (select count(*)::int from public.appointments a join public.patients p on p.id = a.patient_id where p.hn = 'MISS-TEST-001' and a.clinic = 'คลินิกความดัน' and a.status = 'missed'),
  1,
  'only the appointment past cutoff is marked missed'
);

select is(
  (select count(*)::int from public.follow_ups f join public.appointments a on a.id = f.appointment_id join public.patients p on p.id = a.patient_id where p.hn = 'MISS-TEST-001' and a.clinic = 'คลินิกความดัน' and f.status = 'pending'),
  1,
  'exactly one pending follow-up is created for the missed appointment'
);

select is(
  (select count(*)::int from public.appointments a join public.patients p on p.id = a.patient_id where p.hn = 'MISS-TEST-001' and a.status = 'attended'),
  1,
  'attended appointment is left untouched'
);

select is(
  (select count(*)::int from public.appointments a join public.patients p on p.id = a.patient_id where p.hn = 'MISS-TEST-001' and a.status = 'cancelled'),
  1,
  'cancelled appointment is left untouched'
);

-- Idempotency: a second run must not create another follow-up.
select mark_missed_appointments();

select is(
  (select count(*)::int from public.follow_ups f join public.appointments a on a.id = f.appointment_id join public.patients p on p.id = a.patient_id where p.hn = 'MISS-TEST-001' and a.clinic = 'คลินิกความดัน' and f.status = 'pending'),
  1,
  're-running the job does not create a duplicate follow-up'
);

select * from finish();
rollback;
