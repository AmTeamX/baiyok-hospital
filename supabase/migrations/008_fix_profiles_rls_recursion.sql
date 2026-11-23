-- Prevent profiles RLS policies from recursively evaluating current_role().
-- The helper functions are SECURITY DEFINER and explicitly disable row security
-- for their narrowly-scoped lookup of the current user's own profile.

create or replace function public.current_role() returns public.app_role
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select role
  from public.profiles
  where id = auth.uid() and active = true
$$;

create or replace function public.current_service_unit_id() returns uuid
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select service_unit_id
  from public.profiles
  where id = auth.uid() and active = true
$$;

create or replace function public.is_clinical_staff() returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.current_role() in ('admin', 'nurse')
$$;
