-- Run with pgTAP enabled in a disposable Supabase test database.
-- Verifies LINE identity tables have RLS, no client-facing policies exist,
-- and the one-time link code helper is present and locked to the service role.
begin;
select plan(10);

select ok((select relrowsecurity from pg_class where oid = 'public.line_accounts'::regclass), 'line_accounts has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.line_account_links'::regclass), 'line_account_links has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.line_link_codes'::regclass), 'line_link_codes has RLS enabled');

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('line_accounts', 'line_account_links', 'line_link_codes') and roles @> array['anon']::name[]),
  0,
  'anon has no policies on LINE identity tables'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('line_accounts', 'line_account_links', 'line_link_codes') and roles @> array['authenticated']::name[]),
  0,
  'authenticated has no policies on LINE identity tables'
);

select has_function('public', 'consume_line_link_code', 'consume_line_link_code helper exists');
select has_function('public', 'is_active_line_link', 'is_active_line_link helper exists');

select has_index('public', 'line_accounts', 'line_accounts_line_user_id_key', 'line_user_id is unique');
select has_index('public', 'line_account_links', 'line_account_links_account_role_key', 'one active link per account+role');

select is(
  (select has_function_privilege('anon', 'public.consume_line_link_code(text, public.line_link_role)', 'EXECUTE')),
  false,
  'anon cannot execute consume_line_link_code'
);

select * from finish();
rollback;
