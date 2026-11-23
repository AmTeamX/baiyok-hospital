create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'nurse', 'volunteer');
create type public.appointment_status as enum ('scheduled', 'attended', 'missed', 'rescheduled', 'cancelled');
create type public.follow_up_status as enum ('pending', 'assigned', 'contacted', 'rescheduled', 'returned', 'closed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'nurse',
  service_unit text default 'รพ.สต. สระโคล่',
  line_user_id text unique,
  created_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  hn text not null unique,
  full_name text not null,
  birth_date date,
  phone text,
  village text,
  line_user_id text unique,
  consent_line boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_at timestamptz not null,
  clinic text not null,
  status public.appointment_status not null default 'scheduled',
  attended_at timestamptz,
  import_batch text,
  created_at timestamptz not null default now()
);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  status public.follow_up_status not null default 'pending',
  missed_reason text,
  reason_note text,
  counselling_note text,
  assigned_volunteer_id uuid references public.profiles(id),
  new_appointment_id uuid references public.appointments(id),
  returned_confirmed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.follow_up_activities (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references public.follow_ups(id) on delete cascade,
  activity_type text not null,
  note text,
  performed_by uuid references public.profiles(id),
  performed_at timestamptz not null default now()
);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  channel text not null default 'qr',
  unique (appointment_id)
);

create table public.line_webhook_events (
  event_id text primary key,
  event_type text not null,
  line_user_id text,
  is_redelivery boolean not null default false,
  received_at timestamptz not null default now()
);

create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  kind text not null,
  channel text not null,
  status text not null,
  error_message text,
  sent_at timestamptz not null default now(),
  unique (appointment_id, kind)
);

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;
alter table public.follow_ups enable row level security;
alter table public.follow_up_activities enable row level security;
alter table public.check_ins enable row level security;
alter table public.line_webhook_events enable row level security;
alter table public.notification_logs enable row level security;

create or replace function public.current_role() returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create policy "staff read profiles" on public.profiles for select to authenticated using (id = auth.uid() or public.current_role() in ('admin', 'nurse'));
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "staff read patients" on public.patients for select to authenticated using (public.current_role() in ('admin', 'nurse', 'volunteer'));
create policy "clinical staff manage patients" on public.patients for all to authenticated using (public.current_role() in ('admin', 'nurse')) with check (public.current_role() in ('admin', 'nurse'));
create policy "staff read appointments" on public.appointments for select to authenticated using (public.current_role() in ('admin', 'nurse', 'volunteer'));
create policy "clinical staff manage appointments" on public.appointments for all to authenticated using (public.current_role() in ('admin', 'nurse')) with check (public.current_role() in ('admin', 'nurse'));
create policy "staff read follow ups" on public.follow_ups for select to authenticated using (public.current_role() in ('admin', 'nurse') or assigned_volunteer_id = auth.uid());
create policy "clinical staff manage follow ups" on public.follow_ups for all to authenticated using (public.current_role() in ('admin', 'nurse')) with check (public.current_role() in ('admin', 'nurse'));
create policy "volunteer update assigned follow ups" on public.follow_ups for update to authenticated using (assigned_volunteer_id = auth.uid()) with check (assigned_volunteer_id = auth.uid());
create policy "staff read activities" on public.follow_up_activities for select to authenticated using (public.current_role() in ('admin', 'nurse', 'volunteer'));
create policy "staff add activities" on public.follow_up_activities for insert to authenticated with check (performed_by = auth.uid());
create policy "staff read checkins" on public.check_ins for select to authenticated using (public.current_role() in ('admin', 'nurse'));
create policy "clinical staff manage checkins" on public.check_ins for all to authenticated using (public.current_role() in ('admin', 'nurse')) with check (public.current_role() in ('admin', 'nurse'));
create policy "clinical staff read notifications" on public.notification_logs for select to authenticated using (public.current_role() in ('admin', 'nurse'));

alter table public.appointments add constraint appointments_patient_at_clinic_key unique (patient_id, appointment_at, clinic);

create index appointments_patient_at_idx on public.appointments(patient_id, appointment_at desc);
create index appointments_status_at_idx on public.appointments(status, appointment_at);
create index follow_ups_status_idx on public.follow_ups(status, updated_at desc);
