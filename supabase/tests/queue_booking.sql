-- Run with pgTAP enabled in a disposable Supabase test database.
-- Verifies queue booking: capacity enforcement, duplicate prevention, capacity
-- return on cancel, and check-in -> booking checked_in via the trigger.
begin;
select plan(8);

insert into public.service_units (name) values ('หน่วยทดสอบคิว')
on conflict (name) do nothing;

insert into public.patients (hn, full_name, service_unit_id)
values ('QUE-TEST-001', 'ผู้ป่วยทดสอบคิว', (select id from public.service_units where name = 'หน่วยทดสอบคิว'))
on conflict (hn) do nothing;

insert into public.queue_slots (clinic, service_date, starts_at, ends_at, capacity)
values ('คลินิกความดัน', current_date + 1, (current_date + 1)::timestamp + interval '08:00', (current_date + 1)::timestamp + interval '09:00', 2);

-- 1) booking creates an appointment and a queue number.
select is(
  (select (public.book_slot(
       (select id from public.queue_slots limit 1),
       (select id from public.patients where hn = 'QUE-TEST-001')) ->> 'queue_number')::int),
  1,
  'the first booking gets queue number 1'
);

select is(
  (select b.appointment_id is not null from public.queue_bookings b join public.patients p on p.id = b.patient_id where p.hn = 'QUE-TEST-001'),
  true,
  'the booking is linked to an appointment'
);

-- 2) the same patient cannot book again on the same day.
select throws_ok(
  $$ select public.book_slot(
       (select id from public.queue_slots limit 1),
       (select id from public.patients where hn = 'QUE-TEST-001')) $$,
  'P0007',
  'a duplicate same-day booking is rejected'
);

-- 3) a second patient fills the slot to capacity.
insert into public.patients (hn, full_name, service_unit_id)
values ('QUE-TEST-002', 'ผู้ป่วยทดสอบคิว 2', (select id from public.service_units where name = 'หน่วยทดสอบคิว'))
on conflict (hn) do nothing;

select is(
  (select (public.book_slot(
       (select id from public.queue_slots limit 1),
       (select id from public.patients where hn = 'QUE-TEST-002')) ->> 'queue_number')::int),
  2,
  'the second booking gets queue number 2'
);

-- 4) a third booking over capacity is rejected (overbooking prevention).
insert into public.patients (hn, full_name, service_unit_id)
values ('QUE-TEST-003', 'ผู้ป่วยทดสอบคิว 3', (select id from public.service_units where name = 'หน่วยทดสอบคิว'))
on conflict (hn) do nothing;

select throws_ok(
  $$ select public.book_slot(
       (select id from public.queue_slots limit 1),
       (select id from public.patients where hn = 'QUE-TEST-003')) $$,
  'P0007',
  'a booking beyond capacity is rejected'
);

-- 5) cancelling returns capacity.
select is(
  (select (public.cancel_booking(
       (select b.id from public.queue_bookings b join public.patients p on p.id = b.patient_id where p.hn = 'QUE-TEST-002'),
       (select id from public.patients where hn = 'QUE-TEST-002')) ->> 'status')),
  'cancelled',
  'a booking is cancelled'
);

select is(
  (select booked_count from public.queue_slots limit 1),
  1,
  'cancelling returns capacity'
);

-- 6) check-in marks the booking checked-in.
select public.check_in_appointment(
  (select b.appointment_id from public.queue_bookings b join public.patients p on p.id = b.patient_id where p.hn = 'QUE-TEST-001'),
  'nonce-q', 'qr');

select is(
  (select b.status from public.queue_bookings b join public.patients p on p.id = b.patient_id where p.hn = 'QUE-TEST-001'),
  'checked_in',
  'checking in the appointment marks the booking checked-in'
);

-- 7) after a full slot closes, re-booking is still guarded by capacity check.
select is(
  (select s.booked_count <= s.capacity from public.queue_slots s limit 1),
  true,
  'booked count never exceeds capacity'
);

select * from finish();
rollback;
