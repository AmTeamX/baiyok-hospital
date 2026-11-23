-- Atomic, idempotent import commits. Apply after 003_rls_policies.sql.
create or replace function public.commit_import_batch(
  p_kind text,
  p_filename text,
  p_checksum text,
  p_created_by uuid,
  p_rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.import_batches;
  v_patient_id uuid;
  v_item record;
  v_count integer := 0;
  v_attended integer := 0;
begin
  insert into public.import_batches (kind, filename, checksum, status, total_rows, valid_rows, invalid_rows, created_by)
  values (p_kind, p_filename, p_checksum, 'preview', jsonb_array_length(p_rows), jsonb_array_length(p_rows), 0, p_created_by)
  on conflict (checksum, kind) do update set filename = excluded.filename
  returning * into v_batch;

  if v_batch.status = 'committed' then
    return jsonb_build_object('batch_id', v_batch.id, 'idempotent', true, 'rows', v_batch.valid_rows);
  end if;

  if p_kind = 'appointments' then
    for v_item in
      select * from jsonb_to_recordset(p_rows) as x(
        hn text, full_name text, phone text, village text,
        appointment_at timestamptz, clinic text, service_result text
      )
    loop
      insert into public.patients (hn, full_name, phone, village)
      values (v_item.hn, v_item.full_name, nullif(v_item.phone, ''), nullif(v_item.village, ''))
      on conflict (hn) do update set full_name = excluded.full_name, phone = excluded.phone, village = excluded.village
      returning id into v_patient_id;

      insert into public.appointments (
        patient_id, appointment_at, clinic, status, attended_at,
        attendance_source, import_batch, import_batch_id
      )
      values (
        v_patient_id, v_item.appointment_at, v_item.clinic,
        case when nullif(v_item.service_result, '') is null then 'scheduled'::public.appointment_status else 'attended'::public.appointment_status end,
        case when nullif(v_item.service_result, '') is null then null else now() end,
        case when nullif(v_item.service_result, '') is null then null else 'import' end,
        v_batch.id::text, v_batch.id
      )
      on conflict (patient_id, appointment_at, clinic) do update set
        status = excluded.status,
        attended_at = excluded.attended_at,
        attendance_source = excluded.attendance_source,
        import_batch = excluded.import_batch,
        import_batch_id = excluded.import_batch_id;
      v_count := v_count + 1;
      if nullif(v_item.service_result, '') is not null then v_attended := v_attended + 1; end if;
    end loop;
  elsif p_kind = 'service_results' then
    for v_item in
      select * from jsonb_to_recordset(p_rows) as x(
        hn text, service_date date, clinic text, service_result text
      )
    loop
      update public.appointments a
      set status = 'attended', attended_at = now(), attendance_source = 'import',
          import_batch = v_batch.id::text, import_batch_id = v_batch.id
      from public.patients p
      where a.patient_id = p.id
        and p.hn = v_item.hn
        and a.clinic = v_item.clinic
        and a.appointment_at >= (v_item.service_date::text || 'T00:00:00+07:00')::timestamptz
        and a.appointment_at < ((v_item.service_date + 1)::text || 'T00:00:00+07:00')::timestamptz;
      v_count := v_count + 1;
      v_attended := v_attended + 1;
    end loop;
  else
    raise exception 'Unsupported import kind: %', p_kind;
  end if;

  update public.import_batches
  set status = 'committed', total_rows = jsonb_array_length(p_rows),
      valid_rows = jsonb_array_length(p_rows), invalid_rows = 0, committed_at = now()
  where id = v_batch.id;

  insert into public.audit_logs (actor_id, actor_role, service_unit_id, action, entity_type, entity_id, after_data)
  select p_created_by, role, service_unit_id, 'import_committed', 'import_batch', v_batch.id,
         jsonb_build_object('kind', p_kind, 'rows', v_count, 'attended', v_attended, 'checksum', p_checksum)
  from public.profiles where id = p_created_by;

  return jsonb_build_object('batch_id', v_batch.id, 'idempotent', false, 'rows', v_count, 'attended', v_attended);
exception when others then
  if v_batch.id is not null then
    update public.import_batches set status = 'failed' where id = v_batch.id;
  end if;
  raise;
end;
$$;

revoke all on function public.commit_import_batch(text, text, text, uuid, jsonb) from public;
grant execute on function public.commit_import_batch(text, text, text, uuid, jsonb) to service_role;

