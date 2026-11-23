-- Synthetic local/staging seed only. Never run this against a production dataset.
insert into public.service_units (name, timezone)
values ('รพ.สต. สระโคล่', 'Asia/Bangkok')
on conflict (name) do nothing;

-- Profiles are created only for matching Auth users, so this seed never creates credentials.
insert into public.profiles (id, full_name, role, service_unit_id)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
       case when u.email like 'admin+%@example.test' then 'admin'::public.app_role
            when u.email like 'volunteer+%@example.test' then 'volunteer'::public.app_role
            else 'nurse'::public.app_role end,
       s.id
from auth.users u
cross join (select id from public.service_units where name = 'รพ.สต. สระโคล่' limit 1) s
where u.email in ('admin+demo@example.test', 'nurse+demo@example.test', 'volunteer+demo@example.test')
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, service_unit_id = excluded.service_unit_id, active = true;

insert into public.patients (hn, full_name, birth_date, phone, village, service_unit_id)
select v.hn, v.full_name, v.birth_date::date, v.phone, v.village, s.id
from (values
  ('DEMO-001', 'ผู้ป่วยตัวอย่าง หนึ่ง', '1965-04-12', '0800000001', 'หมู่ 1'),
  ('DEMO-002', 'ผู้ป่วยตัวอย่าง สอง', '1972-09-25', '0800000002', 'หมู่ 2')
) as v(hn, full_name, birth_date, phone, village)
cross join (select id from public.service_units where name = 'รพ.สต. สระโคล่' limit 1) s
on conflict (hn) do nothing;

