-- Make the one-time link-code role optional so the client no longer needs to
-- send it (LINE's LIFF deep link drops query params, so the role is derived
-- from the code instead of claimed by the client).
-- Apply after 015_patient_volunteer.sql.

create or replace function public.consume_line_link_code(
  p_token_hash text,
  p_claimed_role public.line_link_role default null
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

  if p_claimed_role is not null and v_code.intended_role <> p_claimed_role then
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
