-- STEP 8 — LIFF สำหรับผู้ป่วยและสุขศึกษา (PAT-01..03).
-- Apply after 011_return_closure.sql. Never edit a migration already applied in production.
--
-- Adds patient requests (problem/consult workflow), health content + reflective
-- questions + answers, and a staff transition RPC. All tables are service-role-only
-- (no anon/authenticated policies) because patient access goes through the patient
-- APIs that resolve identity from the verified LINE context.

create table if not exists public.patient_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  request_type text not null check (request_type in ('problem', 'consult')),
  reason_code text not null,
  note text,
  status text not null default 'new'
    check (status in ('new', 'acknowledged', 'contacted', 'resolved', 'unable_to_contact')),
  assigned_to uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);
create index if not exists patient_requests_patient_idx on public.patient_requests(patient_id, created_at desc);
create index if not exists patient_requests_status_idx on public.patient_requests(status, created_at) where status <> 'resolved';

create table if not exists public.health_contents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null,
  image_url text,
  image_alt text,
  version integer not null default 1,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_questions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.health_contents(id) on delete cascade,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  unique (content_id, sort_order)
);

create table if not exists public.health_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.health_questions(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  selected_value text not null,
  content_version integer not null default 1,
  created_at timestamptz not null default now(),
  unique (question_id, patient_id)
);

alter table public.patient_requests enable row level security;
alter table public.health_contents enable row level security;
alter table public.health_questions enable row level security;
alter table public.health_answers enable row level security;

drop trigger if exists health_contents_set_updated_at on public.health_contents;
create trigger health_contents_set_updated_at before update on public.health_contents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Reference health content (published). Idempotent for local reset.
-- ---------------------------------------------------------------------------
insert into public.health_contents (slug, title, body, version, published)
values
  ('no-symptoms', 'ไม่มีอาการ ไม่ได้แปลว่าหาย', 'ความดันสูงมักไม่แสดงอาการ แต่ยังทำร้ายหัวใจ สมอง ไต และดวงตาได้โดยไม่รู้ตัว', 1, true),
  ('dont-stop-meds', 'ไม่หยุดยา ไม่ซื้อยาเอง', 'ยาความดันต้องใช้ต่อเนื่อง การหยุดยาเองทำให้ความดันพุ่งสูงโดยไม่รู้ตัว', 1, true),
  ('less-salt', 'ลดเค็ม ติดตามความดัน', 'ลดเค็ม วัดความดันสม่ำเสมอ เคลื่อนไหวร่างกาย และมารับบริการตามนัด', 1, true),
  ('warning-signs', 'สัญญาณที่ควรติดต่อเจ้าหน้าที่', 'ปวดศีรษะรุนแรง หน้ามืด แขนขาอ่อนแรง พูดไม่ชัด ควรติดต่อเจ้าหน้าที่ทันที', 1, true)
on conflict (slug) do nothing;

insert into public.health_questions (content_id, prompt, options, sort_order)
select c.id, q.prompt, q.options::jsonb, q.sort_order
from (values
  ('no-symptoms', 'ถ้าวันนี้รู้สึกปกติ ยังต้องกินยาและมาตามนัดหรือไม่?', '[{"value":"a","label":"ต้องกินยาและมาตามนัดตามแพทย์สั่ง","correct":true,"feedback":"ถูกต้อง ความดันสูงเงียบ ๆ ก็ยังทำร้ายร่างกายได้"},{"value":"b","label":"ไม่มีอาการก็ไม่ต้องกินยา","correct":false,"feedback":"ไม่ควรหยุดยาเอง เพราะความดันสูงมักไม่แสดงอาการ"} ]', 1),
  ('dont-stop-meds', 'ถ้ายาหมดก่อนวันนัด คุณจะทำอย่างไร?', '[{"value":"a","label":"ติดต่อเจ้าหน้าที่หรือพยาบาลเพื่อขอคำแนะนำ","correct":true,"feedback":"ถูกต้อง การปรึกษาก่อนช่วยให้ปลอดภัย"},{"value":"b","label":"ซื้อยากินเอง","correct":false,"feedback":"ไม่ควรซื้อยาเอง ยาบางชนิดต้องปรับตามอาการ"} ]', 1),
  ('less-salt', 'อาหารแบบไหนช่วยควบคุมความดัน?', '[{"value":"a","label":"รสจืด ลดเค็ม กินผักผลไม้","correct":true,"feedback":"ถูกต้อง ลดเค็มช่วยลดความดันได้"},{"value":"b","label":"อาหารรสจัด ใส่เกลือเยอะ","correct":false,"feedback":"รสเค็มจัดทำให้ความดันสูงขึ้น"} ]', 1),
  ('warning-signs', 'อาการแบบไหนควรติดต่อเจ้าหน้าที่ทันที?', '[{"value":"a","label":"แขนขาอ่อนแรง พูดไม่ชัด","correct":true,"feedback":"ถูกต้อง อาการเหล่านี้ต้องรีบติดต่อเจ้าหน้าที่"},{"value":"b","label":"รอให้อาการเป็นมากขึ้นก่อน","correct":false,"feedback":"ไม่ควรรอ เพราะอาการเหล่านี้อาจเป็นสัญญาณอันตราย"} ]', 1)
) as q(slug, prompt, options, sort_order)
join public.health_contents c on c.slug = q.slug
on conflict (content_id, sort_order) do nothing;

-- ---------------------------------------------------------------------------
-- Staff transition for a patient request. Validates the status and stamps the
-- appropriate timestamp (acknowledged_at / resolved_at) and audit event.
-- ---------------------------------------------------------------------------
create or replace function public.transition_patient_request(
  p_request_id uuid,
  p_actor_id uuid,
  p_status text,
  p_assigned_to uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.app_role;
  v_actor_unit uuid;
  v_request public.patient_requests;
  v_status text;
begin
  select role, service_unit_id into v_actor_role, v_actor_unit
  from public.profiles
  where id = p_actor_id and active = true;

  if v_actor_role not in ('admin', 'nurse') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_request from public.patient_requests where id = p_request_id;
  if not found then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.patients p
    where p.id = v_request.patient_id and p.service_unit_id = v_actor_unit
  ) then
    raise exception 'request_forbidden' using errcode = '42501';
  end if;

  v_status := case
    when p_status in ('new', 'acknowledged', 'contacted', 'resolved', 'unable_to_contact') then p_status
    else v_request.status
  end;

  update public.patient_requests
  set status = v_status,
      assigned_to = coalesce(p_assigned_to, assigned_to),
      acknowledged_at = case when v_status in ('acknowledged', 'contacted', 'resolved') and acknowledged_at is null then now() else acknowledged_at end,
      resolved_at = case when v_status = 'resolved' and resolved_at is null then now() else resolved_at end
  where id = p_request_id;

  insert into public.audit_logs (actor_id, actor_role, service_unit_id, action, entity_type, entity_id, before_data, after_data)
  values (
    p_actor_id, v_actor_role, v_actor_unit, 'patient_request_transitioned', 'patient_request', p_request_id,
    jsonb_build_object('status', v_request.status),
    jsonb_build_object('status', v_status, 'assigned_to', p_assigned_to)
  );

  return jsonb_build_object('request_id', p_request_id, 'status', v_status);
end;
$$;

revoke all on function public.transition_patient_request(uuid, uuid, text, uuid) from public;
grant execute on function public.transition_patient_request(uuid, uuid, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Staff inbox query: patient requests scoped to the staff member's service unit.
-- ---------------------------------------------------------------------------
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
      p.full_name as patient_name,
      vol.full_name as assignee_name
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
