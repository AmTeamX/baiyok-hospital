-- Explicit, atomic case creation; appointment state is preserved.
create or replace function public.create_case(
  p_appointment_id uuid, p_volunteer_id uuid, p_priority text,
  p_note text, p_actor_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor public.profiles;
  v_appointment public.appointments;
  v_unit uuid;
  v_id uuid;
begin
  select * into v_actor from public.profiles where id = p_actor_id and active = true;
  if not found or v_actor.role not in ('admin', 'nurse') or v_actor.service_unit_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_appointment from public.appointments where id = p_appointment_id for update;
  if not found then raise exception 'appointment_not_found' using errcode = 'P0002'; end if;
  select service_unit_id into v_unit from public.patients where id = v_appointment.patient_id;
  if v_unit is distinct from v_actor.service_unit_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select id into v_id from public.follow_ups where appointment_id = p_appointment_id order by created_at limit 1;
  if found then return jsonb_build_object('id', v_id, 'appointment_id', p_appointment_id, 'existing', true); end if;
  if v_appointment.status not in ('scheduled', 'missed') or p_priority is null or p_priority not in ('normal', 'high', 'urgent') then
    raise exception 'appointment_or_priority_invalid' using errcode = 'P0003';
  end if;
  if p_volunteer_id is not null and not exists (
    select 1 from public.profiles where id = p_volunteer_id and role = 'volunteer' and active = true and service_unit_id = v_unit
  ) then raise exception 'volunteer_invalid' using errcode = 'P0003'; end if;
  insert into public.follow_ups (appointment_id, status, priority, reason_note, created_by, assigned_volunteer_id)
    values (p_appointment_id, 'pending', p_priority, nullif(left(trim(p_note), 2000), ''), p_actor_id, p_volunteer_id)
    returning id into v_id;
  -- Existing inheritance trigger selects the patient's owner when none is specified.
  if p_volunteer_id is not null then
    perform public.assign_follow_up(v_id, p_volunteer_id, p_actor_id);
  end if;
  insert into public.audit_logs(actor_id, actor_role, service_unit_id, action, entity_type, entity_id, after_data)
    values(p_actor_id, v_actor.role, v_unit, 'case_created', 'follow_up', v_id,
      jsonb_build_object('appointment_id', p_appointment_id, 'priority', p_priority));
  return jsonb_build_object('id', v_id, 'appointment_id', p_appointment_id, 'existing', false);
end;
$$;
revoke all on function public.create_case(uuid, uuid, text, text, uuid) from public;
grant execute on function public.create_case(uuid, uuid, text, text, uuid) to service_role;
