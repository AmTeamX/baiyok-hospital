-- Production workflow schema for รพ.สต. สระโคล่.
-- Apply after 001_initial.sql. Never edit a migration already applied in production.

create table if not exists public.service_units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  timezone text not null default 'Asia/Bangkok',
  missed_cutoff_hours integer not null default 24 check (missed_cutoff_hours between 1 and 168),
  reminder_enabled boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.service_units (name) values ('รพ.สต. สระโคล่') on conflict (name) do nothing;

create or replace function public.default_service_unit_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.service_units where name = 'รพ.สต. สระโคล่' limit 1
$$;

alter table public.profiles add column if not exists service_unit_id uuid references public.service_units(id);
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.patients add column if not exists service_unit_id uuid references public.service_units(id);
alter table public.patients add column if not exists line_linked_at timestamptz;
alter table public.patients add column if not exists line_consent_at timestamptz;
alter table public.patients add column if not exists line_consent_revoked_at timestamptz;
alter table public.patients add column if not exists contact_preference text not null default 'line' check (contact_preference in ('line', 'phone', 'both', 'none'));

update public.profiles set service_unit_id = (select id from public.service_units where name = coalesce(public.profiles.service_unit, 'รพ.สต. สระโคล่') limit 1) where service_unit_id is null;
update public.patients set service_unit_id = (select id from public.service_units where name = 'รพ.สต. สระโคล่' limit 1) where service_unit_id is null;
alter table public.profiles alter column service_unit_id set default public.default_service_unit_id();
alter table public.patients alter column service_unit_id set default public.default_service_unit_id();

alter table public.appointments add column if not exists external_reference text;
alter table public.appointments add column if not exists source_system text not null default 'manual';
alter table public.appointments add column if not exists superseded_by_appointment_id uuid references public.appointments(id);
alter table public.appointments add column if not exists missed_marked_at timestamptz;
alter table public.appointments add column if not exists attendance_source text check (attendance_source in ('import', 'check_in', 'manual'));
alter table public.appointments add column if not exists updated_at timestamptz not null default now();

alter table public.follow_ups add column if not exists closure_reason text;
alter table public.follow_ups add column if not exists priority text not null default 'normal' check (priority in ('normal', 'high', 'urgent'));
alter table public.follow_ups add column if not exists assigned_at timestamptz;
alter table public.follow_ups add column if not exists contacted_at timestamptz;
alter table public.follow_ups add column if not exists closed_at timestamptz;
alter table public.follow_ups add column if not exists version integer not null default 1 check (version > 0);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('appointments', 'service_results')),
  filename text not null,
  checksum text not null,
  status text not null default 'preview' check (status in ('preview', 'committed', 'failed', 'cancelled')),
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  unique (checksum, kind)
);
create table if not exists public.import_row_errors (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  field text,
  error_code text not null,
  message text not null,
  created_at timestamptz not null default now()
);
alter table public.appointments add column if not exists import_batch_id uuid references public.import_batches(id);

alter table public.notification_logs add column if not exists follow_up_id uuid references public.follow_ups(id) on delete cascade;
alter table public.notification_logs add column if not exists recipient_profile_id uuid references public.profiles(id);
alter table public.notification_logs add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0);
alter table public.notification_logs add column if not exists next_attempt_at timestamptz;
alter table public.notification_logs add column if not exists provider_message_id text;
alter table public.notification_logs add column if not exists idempotency_key text;
alter table public.notification_logs alter column sent_at drop not null;
alter table public.notification_logs alter column sent_at drop default;
alter table public.notification_logs drop constraint if exists notification_logs_appointment_id_kind_key;
alter table public.notification_logs add constraint notification_logs_status_check check (status in ('pending', 'processing', 'sent', 'failed', 'dead_letter'));
create unique index if not exists notification_logs_idempotency_key_idx on public.notification_logs(idempotency_key) where idempotency_key is not null;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  actor_role public.app_role,
  service_unit_id uuid references public.service_units(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists service_units_set_updated_at on public.service_units;
create trigger service_units_set_updated_at before update on public.service_units for each row execute function public.set_updated_at();
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists patients_set_updated_at on public.patients;
create trigger patients_set_updated_at before update on public.patients for each row execute function public.set_updated_at();
drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at before update on public.appointments for each row execute function public.set_updated_at();
drop trigger if exists follow_ups_set_updated_at on public.follow_ups;
create trigger follow_ups_set_updated_at before update on public.follow_ups for each row execute function public.set_updated_at();

alter table public.follow_ups drop constraint if exists follow_ups_appointment_id_key;
create unique index if not exists follow_ups_one_active_per_appointment_idx on public.follow_ups(appointment_id) where status not in ('closed', 'returned');
create index if not exists profiles_service_unit_role_idx on public.profiles(service_unit_id, role) where active;
create index if not exists patients_service_unit_idx on public.patients(service_unit_id);
create index if not exists appointments_external_reference_idx on public.appointments(external_reference) where external_reference is not null;
create index if not exists follow_ups_assignee_status_idx on public.follow_ups(assigned_volunteer_id, status, updated_at desc);
create index if not exists import_batches_created_at_idx on public.import_batches(created_at desc);
create index if not exists notification_logs_pending_idx on public.notification_logs(status, next_attempt_at) where status in ('pending', 'failed');
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);

