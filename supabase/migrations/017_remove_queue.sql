-- Remove the queue-booking feature (STEP 9) — not used yet.
-- 013_queue_booking.sql is kept for history; this migration drops the objects it created.
-- Apply after 016_optional_link_role.sql.

drop trigger if exists appointments_sync_booking on public.appointments;
drop function if exists public.sync_booking_on_attendance();
drop function if exists public.book_slot(uuid, uuid);
drop function if exists public.cancel_booking(uuid, uuid);
drop function if exists public.create_queue_slot(text, date, timestamptz, timestamptz, integer, uuid);
drop function if exists public.set_queue_slot_active(uuid, boolean, uuid);
drop function if exists public.override_booking(uuid, text, text, uuid);
drop table if exists public.queue_bookings;
drop table if exists public.queue_slots;
