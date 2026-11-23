-- Patient-facing notification outbox support for request updates and appointment changes.

alter table public.notification_logs
  alter column appointment_id drop not null;

alter table public.notification_logs
  add column if not exists patient_request_id uuid references public.patient_requests(id) on delete cascade,
  add column if not exists recipient_line_account_id uuid references public.line_accounts(id);

create index if not exists notification_logs_patient_request_idx
  on public.notification_logs(patient_request_id)
  where patient_request_id is not null;

create index if not exists notification_logs_patient_recipient_idx
  on public.notification_logs(recipient_line_account_id)
  where recipient_line_account_id is not null;

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
    select pr.id, pr.request_type, pr.reason_code, pr.note, pr.status,
           pr.assigned_to, pr.appointment_id, pr.created_at, pr.acknowledged_at, pr.resolved_at,
           p.full_name as patient_name, vol.full_name as assignee_name
    from public.patient_requests pr
    join public.patients p on p.id = pr.patient_id
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
