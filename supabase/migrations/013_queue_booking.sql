-- STEP 9 — Queue booking (QUE-01..04).
-- Apply after 012_patient_liff.sql. Never edit a migration already applied in production.
--
-- Adds queue_slots and queue_bookings, plus the transactional booking RPCs that
-- prevent overbooking and duplicate same-day bookings. Bookings are linked to an
-- appointment (created by book_slot) so the existing QR check-in (RET-02) marks the
-- booking checked-in via a trigger. All tables are service-role-only.

create table if not exists public.queue_slots (
  id uuid primary key default gen_random_uuid(),
  clinic text not null,
  service_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  booked_count integer not null default 0 check (booked_count >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists queue_slots_date_idx on public.queue_slots(service_date, starts_at) where active;

create table if not exists public.queue_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.queue_slots(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  service_date date not null,
  queue_number integer not null check (queue_number > 0),
  status text not null default 'booked'
    check (status in ('booked', 'checked_in', 'cancelled', 'no_show')),
  booked_at timestamptz not null default now(),
  checked_in_at timestamptz
);
create unique index if not exists queue_bookings_one_active_per_patient_day
  on public.queue_bookings(patient_id, service_date) where status in ('booked', 'checked_in');
create index if not exists queue_bookings_slot_idx on public.queue_bookings(slot_id, queue_number);

alter table public.queue_slots enable row level security;
alter table public.queue_bookings enable row level security;

-- When a booked appointment becomes attended (QR check-in, import or manual),
-- mark the linked booking as checked-in. Idempotent by construction.
create or replace function public.sync_booking_on_attendance() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.queue_bookings
  set status = 'checked_in', checked_in_at = now()
  where appointment_id = new.id and status = 'booked';
  return new;
end;
$$;

drop trigger if exists appointments_sync_booking on public.appointments;
create trigger appointments_sync_booking
after update of status on public.appointments
for each row
when (new.status = 'attended')
execute function public.sync_booking_on_attendance();

-- ---------------------------------------------------------------------------
-- Atomic booking: locks the slot, enforces capacity and the one-active-booking-
-- per-day rule, creates the linked appointment and booking, then bumps the count.
-- ---------------------------------------------------------------------------
create or replace function public.book_slot(
  p_slot_id uuid,
  p_patient_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.queue_slots;
  v_appointment_id uuid;
  v_booking_id uuid;
  v_queue_number integer;
begin
  select * into v_slot from public.queue_slots where id = p_slot_id for update;
  if not found then
    raise exception 'slot_not_found' using errcode = 'P0002';
  end if;
  if not v_slot.active then
    raise exception 'slot_inactive' using errcode = 'P0006';
  end if;
  if v_slot.booked_count >= v_slot.capacity then
    raise exception 'slot_full' using errcode = 'P0007';
  end if;
  if exists (
    select 1 from public.queue_bookings
    where patient_id = p_patient_id and service_date = v_slot.service_date
      and status in ('booked', 'checked_in')
  ) then
    raise exception 'duplicate_booking' using errcode = 'P0007';
  end if;

  insert into public.appointments (patient_id, appointment_at, clinic, status, source_system)
  values (p_patient_id, v_slot.starts_at, v_slot.clinic, 'scheduled', 'queue')
  returning id into v_appointment_id;

  v_queue_number := v_slot.booked_count + 1;

  insert into public.queue_bookings (slot_id, patient_id, appointment_id, service_date, queue_number, status)
  values (p_slot_id, p_patient_id, v_appointment_id, v_slot.service_date, v_queue_number, 'booked')
  returning id into v_booking_id;

  update public.queue_slots set booked_count = booked_count + 1 where id = p_slot_id;

  return jsonb_build_object(
    'booking_id', v_booking_id,
    'appointment_id', v_appointment_id,
    'queue_number', v_queue_number,
    'slot_id', p_slot_id
  );
end;
$$;

revoke all on function public.book_slot(uuid, uuid) from public;
grant execute on function public.book_slot(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Patient cancels a booking, returning capacity and cancelling the appointment.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_patient_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.queue_bookings;
begin
  select * into v_booking from public.queue_bookings
  where id = p_booking_id and patient_id = p_patient_id and status = 'booked'
  for update;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  update public.queue_bookings set status = 'cancelled' where id = p_booking_id;
  update public.queue_slots set booked_count = greatest(booked_count - 1, 0) where id = v_booking.slot_id;
  update public.appointments set status = 'cancelled', updated_at = now()
  where id = v_booking.appointment_id and status = 'scheduled';

  return jsonb_build_object('booking_id', p_booking_id, 'status', 'cancelled');
end;
$$;

revoke all on function public.cancel_booking(uuid, uuid) from public;
grant execute on function public.cancel_booking(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Staff slot management + booking override.
-- ---------------------------------------------------------------------------
create or replace function public.create_queue_slot(
  p_clinic text,
  p_service_date date,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_capacity integer,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.app_role;
  v_actor_unit uuid;
  v_slot_id uuid;
begin
  select role, service_unit_id into v_actor_role, v_actor_unit
  from public.profiles where id = p_actor_id and active = true;
  if v_actor_role not in ('admin', 'nurse') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_capacity < 1 then
    raise exception 'invalid_capacity' using errcode = 'P0008';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'invalid_window' using errcode = 'P0008';
  end if;

  insert into public.queue_slots (clinic, service_date, starts_at, ends_at, capacity)
  values (p_clinic, p_service_date, p_starts_at, p_ends_at, p_capacity)
  returning id into v_slot_id;

  insert into public.audit_logs (actor_id, actor_role, service_unit_id, action, entity_type, entity_id, after_data)
  values (p_actor_id, v_actor_role, v_actor_unit, 'queue_slot_created', 'queue_slot', v_slot_id,
          jsonb_build_object('clinic', p_clinic, 'service_date', p_service_date, 'capacity', p_capacity));

  return jsonb_build_object('slot_id', v_slot_id);
end;
$$;

revoke all on function public.create_queue_slot(text, date, timestamptz, timestamptz, integer, uuid) from public;
grant execute on function public.create_queue_slot(text, date, timestamptz, timestamptz, integer, uuid) to service_role;

create or replace function public.set_queue_slot_active(
  p_slot_id uuid,
  p_active boolean,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.app_role;
  v_actor_unit uuid;
begin
  select role, service_unit_id into v_actor_role, v_actor_unit
  from public.profiles where id = p_actor_id and active = true;
  if v_actor_role not in ('admin', 'nurse') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.queue_slots where id = p_slot_id) then
    raise exception 'slot_not_found' using errcode = 'P0002';
  end if;

  update public.queue_slots set active = p_active where id = p_slot_id;

  insert into public.audit_logs (actor_id, actor_role, service_unit_id, action, entity_type, entity_id, after_data)
  values (p_actor_id, v_actor_role, v_actor_unit, 'queue_slot_active_changed', 'queue_slot', p_slot_id,
          jsonb_build_object('active', p_active));

  return jsonb_build_object('slot_id', p_slot_id, 'active', p_active);
end;
$$;

revoke all on function public.set_queue_slot_active(uuid, boolean, uuid) from public;
grant execute on function public.set_queue_slot_active(uuid, boolean, uuid) to service_role;

create or replace function public.override_booking(
  p_booking_id uuid,
  p_status text,
  p_reason text,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.app_role;
  v_actor_unit uuid;
  v_status text;
begin
  select role, service_unit_id into v_actor_role, v_actor_unit
  from public.profiles where id = p_actor_id and active = true;
  if v_actor_role not in ('admin', 'nurse') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_status := case when p_status in ('checked_in', 'no_show', 'cancelled') then p_status else 'no_show' end;

  update public.queue_bookings
  set status = v_status,
      checked_in_at = case when v_status = 'checked_in' then coalesce(checked_in_at, now()) else checked_in_at end
  where id = p_booking_id;

  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (actor_id, actor_role, service_unit_id, action, entity_type, entity_id, after_data)
  values (p_actor_id, v_actor_role, v_actor_unit, 'queue_booking_overridden', 'queue_booking', p_booking_id,
          jsonb_build_object('status', v_status, 'reason', p_reason));

  return jsonb_build_object('booking_id', p_booking_id, 'status', v_status);
end;
$$;

revoke all on function public.override_booking(uuid, text, text, uuid) from public;
grant execute on function public.override_booking(uuid, text, text, uuid) to service_role;
