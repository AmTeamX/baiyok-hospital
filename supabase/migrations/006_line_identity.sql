-- LINE identity: accounts, links, one-time link codes and rich-menu state.
-- Apply after 004_import_commit_rpc.sql. Never edit a migration already applied in production.

create type public.line_link_role as enum ('patient', 'volunteer');
create type public.line_link_status as enum ('active', 'revoked', 'deactivated');

create table public.line_accounts (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null unique,
  display_name text,
  picture_url text,
  friend_status text not null default 'unknown'
    check (friend_status in ('unknown', 'added', 'blocked', 'unfollowed')),
  rich_menu_id text,
  rich_menu_linked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.line_account_links (
  id uuid primary key default gen_random_uuid(),
  line_account_id uuid not null references public.line_accounts(id) on delete cascade,
  role public.line_link_role not null,
  patient_id uuid references public.patients(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  status public.line_link_status not null default 'active',
  consented_at timestamptz,
  revoked_at timestamptz,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint line_account_links_target_check check (
    (role = 'patient' and patient_id is not null and profile_id is null)
    or (role = 'volunteer' and profile_id is not null and patient_id is null)
  ),
  constraint line_account_links_account_role_key unique (line_account_id, role)
);

create table public.line_link_codes (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('patient', 'profile')),
  target_id uuid not null,
  intended_role public.line_link_role not null,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists line_link_codes_token_hash_idx on public.line_link_codes(token_hash);
create index if not exists line_link_codes_pending_idx on public.line_link_codes(used_at, expires_at);
create index if not exists line_account_links_patient_idx on public.line_account_links(patient_id) where patient_id is not null;
create index if not exists line_account_links_profile_idx on public.line_account_links(profile_id) where profile_id is not null;

-- Atomically consume a one-time link code so concurrent verifies cannot reuse it.
-- Raises a stable SQLSTATE for each rejection reason so the API can map it to a response.
create or replace function public.consume_line_link_code(
  p_token_hash text,
  p_claimed_role public.line_link_role
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.line_link_codes;
begin
  select * into v_code
  from public.line_link_codes
  where token_hash = p_token_hash and used_at is null and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if v_code.id is null then
    if exists (select 1 from public.line_link_codes where token_hash = p_token_hash and used_at is not null) then
      raise exception 'LINE_LINK_CODE_USED' using errcode = 'LLC01';
    elsif exists (select 1 from public.line_link_codes where token_hash = p_token_hash and expires_at <= now()) then
      raise exception 'LINE_LINK_CODE_EXPIRED' using errcode = 'LLC02';
    else
      raise exception 'LINE_LINK_CODE_INVALID' using errcode = 'LLC03';
    end if;
  end if;

  if v_code.intended_role <> p_claimed_role then
    raise exception 'LINE_LINK_CODE_WRONG_TARGET' using errcode = 'LLC04';
  end if;

  update public.line_link_codes set used_at = now() where id = v_code.id;

  return jsonb_build_object(
    'target_type', v_code.target_type,
    'target_id', v_code.target_id,
    'intended_role', v_code.intended_role
  );
end;
$$;

revoke all on function public.consume_line_link_code(text, public.line_link_role) from public;
grant execute on function public.consume_line_link_code(text, public.line_link_role) to service_role;

create or replace function public.is_active_line_link(p_link_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.line_account_links where id = p_link_id and status = 'active')
$$;

revoke all on function public.is_active_line_link(uuid) from public;
grant execute on function public.is_active_line_link(uuid) to service_role;

alter table public.line_accounts enable row level security;
alter table public.line_account_links enable row level security;
alter table public.line_link_codes enable row level security;

-- These tables are read/written only by trusted server code using the service role.
-- No anon/authenticated policies are created, so a compromised app session cannot
-- read or mutate LINE identity or link data directly.

drop trigger if exists line_accounts_set_updated_at on public.line_accounts;
create trigger line_accounts_set_updated_at before update on public.line_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists line_account_links_set_updated_at on public.line_account_links;
create trigger line_account_links_set_updated_at before update on public.line_account_links
  for each row execute function public.set_updated_at();
