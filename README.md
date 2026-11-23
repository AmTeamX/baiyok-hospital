# รพ.สต. สระโคล่ — ระบบติดตามผู้ป่วยขาดนัด

MVP สำหรับพยาบาลและ อสม. เพื่อติดตามผู้ป่วยความดันโลหิตสูงที่ขาดนัด ตั้งแต่นำเข้ารายการนัด ประเมินสาเหตุ บันทึกกิจกรรมพยาบาล มอบหมาย อสม. นัดใหม่ จนถึงยืนยันว่ากลับมารับบริการจริง

## เริ่มใช้งาน

```bash
npm install
cp .env.example .env.local
npm run dev
```

ตรวจความพร้อมของ runtime ได้ที่ `GET /api/health/config` ระบบจะรายงานเฉพาะชื่อ configuration ที่ขาด ไม่แสดงค่า secret โดย `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CHECKIN_SIGNING_SECRET` และ `CRON_SECRET` เป็น required สำหรับ production; ค่า LINE OA/LIFF เป็น optional จนกว่าจะเปิด workflow LINE จริง

ถ้ายังไม่ใส่ Supabase ระบบจะทำงานในโหมดสาธิตโดยไม่บันทึกข้อมูลจริง เมื่อใส่ค่า Supabase แล้วหน้าเจ้าหน้าที่จะบังคับเข้าสู่ระบบ และ API ตรวจบทบาท `admin`/`nurse` ซ้ำก่อนใช้ service role

## ตั้งค่า Supabase

1. สร้างโปรเจกต์ Supabase และรัน `supabase/migrations/001_initial.sql`, `002_production_workflows.sql`, `003_rls_policies.sql`, `004_import_commit_rpc.sql` และ `005_missed_workflows.sql` ตามลำดับใน SQL editor
2. คัดลอก `.env.example` เป็น `.env.local` แล้วเติมค่าจริง โดยห้าม commit ไฟล์ที่มี secret
3. เติม `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` และ `SUPABASE_SERVICE_ROLE_KEY` ใน `.env.local`
4. สร้างผู้ใช้เจ้าหน้าที่ใน Supabase Auth แล้วเพิ่มแถวที่ตรงกันใน `profiles` พร้อม `service_unit_id` ของ รพ.สต. สระโคล่
5. สำหรับ local/staging ให้รัน `supabase/seed.sql` หลังสร้าง Auth users ตัวอย่าง `admin+demo@example.test`, `nurse+demo@example.test` และ `volunteer+demo@example.test`; seed นี้ใช้ข้อมูลสังเคราะห์เท่านั้น

ไฟล์ `lib/supabase/database.types.ts` เป็น type contract ที่ต้อง regenerate เมื่อ schema เปลี่ยน และห้ามใช้ `any` เพื่อหลบ schema mismatch
ไฟล์ `supabase/tests/rls_policies.sql` ใช้ตรวจ RLS ในฐานข้อมูลทดสอบที่เปิด pgTAP แล้ว ห้ามรันชุด seed กับ production โดยตรง

## ตั้งค่า LINE OA

1. สร้าง Messaging API channel และ LIFF app โดยตั้ง Endpoint URL เป็น `https://<โดเมนแอป>/liff/link` ตัวกลางนี้เรียก `liff.init()` ก่อนอ่านพารามิเตอร์และเปิดหน้าปลายทางจาก `destination` ที่อนุญาตเท่านั้น
2. ตั้ง webhook เป็น `https://<โดเมน>/api/line/webhook`
3. เติม `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `NEXT_PUBLIC_LIFF_ID`, `NEXT_PUBLIC_LINE_OA_BASIC_ID` และสุ่ม `CHECKIN_SIGNING_SECRET` สำหรับลงลายเซ็น QR
4. เปิด webhook redelivery และตั้ง Rich Menu ให้ลิงก์ไปหน้าวันนัด สื่อสุขภาพ แจ้งปัญหา และขอคำปรึกษา

ภาพ Rich Menu และรูปโปรไฟล์อยู่ใน `public/rich-menu/` หลัง deploy กด **อัปเดตเมนู LINE** ในหน้าทีม หรือใช้ endpoint เจ้าหน้าที่ `POST /api/admin/line/rich-menus` เพื่อสร้าง/อัปโหลดและสลับเมนูให้บัญชีเดิมตามบทบาท ลิงก์ทุกปุ่มใช้ `https://liff.line.me/<LIFF ID>?destination=...` ระบบใช้ชื่อเวอร์ชันตามเนื้อหาเมนูจึงใช้เมนูเดิมซ้ำเฉพาะเมื่อ actions ตรงกัน และค้นหา ID ของเวอร์ชันปัจจุบันให้อัตโนมัติ (`LINE_RICH_MENU_*_ID` ยังใช้เป็น fallback ได้) หลังผูกบัญชี API ส่ง `richMenuStatus` เพื่อบอกว่าสลับเมนูสำเร็จหรือยัง

Webhook ตรวจ `x-line-signature` ทุกครั้งและเก็บเฉพาะ metadata ที่จำเป็นเพื่อกัน event ซ้ำ ส่วน Vercel Cron เรียก `/api/jobs/reminders` เวลา 08:00 น. ประเทศไทยทุกวัน เพื่อส่งข้อความเตือนนัดวันถัดไปแบบไม่ส่งซ้ำ และเรียก `/api/jobs/mark-missed` รายชั่วโมงเพื่อตัดนัดที่เลยกำหนดของหน่วยบริการเป็น `missed` พร้อมสร้าง follow-up เพียงรายการเดียว (รันซ้ำได้โดยไม่สร้างซ้ำ)

## Deploy บน Vercel

เชื่อม repository กับ Vercel, เพิ่ม environment variables เดียวกับ `.env.example` ใน Production/Preview แล้ว deploy ใหม่เมื่อค่าเปลี่ยน

## ขอบเขต MVP

- Dashboard และทะเบียนผู้ขาดนัด
- นำเข้า Excel/CSV พร้อมตรวจหัวคอลัมน์
- แบบประเมินสาเหตุ บันทึกคำปรึกษา นัดใหม่ และยืนยันผล
- หน้าสื่อสุขภาพและหน้าผู้ป่วยตัวอักษรใหญ่
- QR check-in แบบ signed URL (ไม่ใส่ HN ใน URL) และบันทึกการมารับบริการจริง
- Supabase schema + RLS เริ่มต้น และเส้นทางบันทึกข้อมูลนำเข้า/การติดตามเมื่อมี service role
- LINE webhook signature verification
- LINE push reminder วันก่อนนัด พร้อม consent และ idempotency log

ก่อนใช้กับข้อมูลผู้ป่วยจริง ต้องเพิ่ม audit log, กำหนด consent/retention policy, ทบทวน encryption/backup, ทำ data mapping กับไฟล์จริงของหน่วยบริการ และทดสอบ authentication/RLS ครบทุกบทบาท
