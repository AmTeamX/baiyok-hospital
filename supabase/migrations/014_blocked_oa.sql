-- Blocked-OA detection: add a terminal 'blocked' state for notifications whose
-- recipient has blocked or unfriended the LINE Official Account.
-- Apply after 013_queue_booking.sql. Never edit a migration already applied in production.

alter table public.notification_logs drop constraint if exists notification_logs_status_check;
alter table public.notification_logs add constraint notification_logs_status_check
  check (status in ('pending', 'processing', 'sent', 'failed', 'dead_letter', 'unlinked', 'cancelled', 'blocked'));
