-- Staff responses and direct appointment actions inside the patient-request inbox.
alter table public.patient_requests
  add column if not exists staff_response text;

create or replace function public.search_patient_requests(
  p_service_unit_id uuid,
  p_status text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_rows jsonb;
begin
  v_status := case when p_status in ('new', 'acknowledged', 'contacted', 'resolved', 'unable_to_contact') then p_status else null end;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
  from (
    select
      pr.id,
      pr.request_type,
      pr.reason_code,
      pr.note,
      pr.status,
      pr.assigned_to,
      pr.created_at,
      pr.acknowledged_at,
      pr.resolved_at,
      pr.appointment_id,
      pr.patient_id,
      pr.staff_response,
      p.full_name as patient_name,
      vol.full_name as assignee_name,
      a.appointment_at,
      a.clinic as appointment_clinic
    from public.patient_requests pr
    join public.patients p on p.id = pr.patient_id
    left join public.appointments a on a.id = pr.appointment_id
    left join public.profiles vol on vol.id = pr.assigned_to
    where p.service_unit_id = p_service_unit_id
      and (v_status is null or pr.status = v_status)
    order by (pr.status in ('resolved', 'unable_to_contact')) asc, pr.created_at desc
  ) t;

  return jsonb_build_object('rows', v_rows);
end;
$$;

revoke all on function public.search_patient_requests(uuid, text) from public;
grant execute on function public.search_patient_requests(uuid, text) to service_role;
