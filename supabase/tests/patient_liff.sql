-- Run with pgTAP enabled in a disposable Supabase test database.
-- Verifies the patient-request workflow RPCs and scoping.
begin;
select plan(6);

insert into public.service_units (name, timezone, sla_hours)
values ('หน่วยทดสอบคำขอ', 'Asia/Bangkok', 48)
on conflict (name) do nothing;

insert into public.patients (hn, full_name, service_unit_id)
values ('REQ-TEST-001', 'ผู้ป่วยทดสอบคำขอ', (select id from public.service_units where name = 'หน่วยทดสอบคำขอ'))
on conflict (hn) do nothing;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000d1', 'nurse-req@example.test'),
  ('00000000-0000-4000-8000-0000000000d2', 'nurse-other@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role, service_unit_id, active)
select t.id, t.name, 'nurse'::public.app_role, su.id, true
from (values
  ('00000000-0000-4000-8000-0000000000d1', 'พยาบาล คำขอ'),
  ('00000000-0000-4000-8000-0000000000d2', 'พยาบาล อื่น')
) as t(id, name), public.service_units su
where su.name = case when t.name = 'พยาบาล คำขอ' then 'หน่วยทดสอบคำขอ' else 'รพ.สต. สระโคล่' end
on conflict (id) do nothing;

insert into public.patient_requests (patient_id, request_type, reason_code, status)
select p.id, 'problem', 'travel_difficulty', 'new'
from public.patients p where p.hn = 'REQ-TEST-001';

-- 1) a nurse from the same service unit can acknowledge.
select is(
  (select (public.transition_patient_request(
       (select id from public.patient_requests pr join public.patients p on p.id = pr.patient_id where p.hn = 'REQ-TEST-001'),
       '00000000-0000-4000-8000-0000000000d1', 'acknowledged', null) ->> 'status')),
  'acknowledged',
  'a same-unit nurse acknowledges the request'
);

select is(
  (select acknowledged_at is not null from public.patient_requests pr join public.patients p on p.id = pr.patient_id where p.hn = 'REQ-TEST-001'),
  true,
  'acknowledged_at is stamped'
);

-- 2) a nurse from another service unit is denied.
select throws_ok(
  $$ select public.transition_patient_request(
       (select id from public.patient_requests pr join public.patients p on p.id = pr.patient_id where p.hn = 'REQ-TEST-001'),
       '00000000-0000-4000-8000-0000000000d2', 'resolved', null) $$,
  '42501',
  'a cross-unit nurse is denied'
);

-- 3) resolving stamps resolved_at.
select is(
  (select (public.transition_patient_request(
       (select id from public.patient_requests pr join public.patients p on p.id = pr.patient_id where p.hn = 'REQ-TEST-001'),
       '00000000-0000-4000-8000-0000000000d1', 'resolved', null) ->> 'status')),
  'resolved',
  'the request resolves'
);

select is(
  (select resolved_at is not null from public.patient_requests pr join public.patients p on p.id = pr.patient_id where p.hn = 'REQ-TEST-001'),
  true,
  'resolved_at is stamped'
);

-- 4) the inbox query returns the request for the correct unit.
select is(
  (select count(*)::int from jsonb_array_elements(
    public.search_patient_requests((select id from public.service_units where name = 'หน่วยทดสอบคำขอ'), null) -> 'rows')),
  1,
  'the inbox query returns the request scoped to the unit'
);

select * from finish();
rollback;
