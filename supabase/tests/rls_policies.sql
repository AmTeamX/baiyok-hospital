-- Run with pgTAP enabled in a disposable Supabase test database.
-- This verifies that sensitive tables have RLS and that no public/anon policy exists.
begin;
select plan(12);

select ok((select relrowsecurity from pg_class where oid = 'public.patients'::regclass), 'patients has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.appointments'::regclass), 'appointments has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.follow_ups'::regclass), 'follow_ups has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.audit_logs'::regclass), 'audit_logs has RLS enabled');

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('audit_logs', 'line_webhook_events') and roles @> array['anon']::name[]), 0, 'anon cannot read trusted tables');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('audit_logs', 'line_webhook_events') and roles @> array['authenticated']::name[]), 0, 'authenticated cannot read trusted tables');

select has_function('public', 'current_role', 'current_role helper exists');
select has_function('public', 'current_service_unit_id', 'service unit helper exists');
select has_function('public', 'can_read_follow_up', 'follow-up authorization helper exists');
select has_function('public', 'assign_follow_up', 'assign_follow_up RPC exists');
select has_function('public', 'reschedule_follow_up', 'reschedule_follow_up RPC exists');
select has_index('public', 'follow_ups', 'follow_ups_one_active_per_appointment_idx', 'active follow-up uniqueness exists');

select * from finish();
rollback;

