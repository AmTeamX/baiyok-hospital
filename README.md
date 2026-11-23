# รพ.สต. สระโคล่ — ระบบติดตามผู้ป่วยขาดนัด

MVP สำหรับพยาบาลและ อสม. เพื่อติดตามผู้ป่วยความดันโลหิตสูงที่ขาดนัด ตั้งแต่นำเข้ารายการนัด ประเมินสาเหตุ บันทึกกิจกรรมพยาบาล มอบหมาย อสม. นัดใหม่ จนถึงยืนยันว่ากลับมารับบริการจริง

## เริ่มใช้งาน

```bash
npm install
cp .env.example .env.local
npm run dev
```

ตรวจความพร้อมของ runtime ได้ที่ `GET /api/health/config` ระบบจะรายงานเฉพาะชื่อ configuration ที่ขาด ไม่แสดงค่า secret

ถ้ายังไม่ใส่ Supabase ระบบจะทำงานในโหมดสาธิตโดยไม่บันทึกข้อมูลจริง เมื่อใส่ค่า Supabase แล้วหน้าเจ้าหน้าที่จะบังคับเข้าสู่ระบบ และ API ตรวจบทบาท `admin`/`nurse` ซ้ำก่อนใช้ service role

## ตั้งค่า Supabase

1. สร้างโปรเจกต์ Supabase และรัน `supabase/migrations/001_initial.sql` ใน SQL editor
2. คัดลอก `.env.example` เป็น `.env.local` แล้วเติมค่าจริง โดยห้าม commit ไฟล์ที่มี secret
3. เติม `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` และ `SUPABASE_SERVICE_ROLE_KEY` ใน `.env.local`
4. สร้างผู้ใช้เจ้าหน้าที่ใน Supabase Auth แล้วเพิ่มแถวที่ตรงกันใน `profiles`

## ตั้งค่า LINE OA

1. สร้าง Messaging API channel และ LIFF app
2. ตั้ง webhook เป็น `https://<โดเมน>/api/line/webhook`
3. เติม `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `NEXT_PUBLIC_LIFF_ID`, `NEXT_PUBLIC_LINE_OA_BASIC_ID` และสุ่ม `CHECKIN_SIGNING_SECRET` สำหรับลงลายเซ็น QR
4. เปิด webhook redelivery และตั้ง Rich Menu ให้ลิงก์ไปหน้าวันนัด สื่อสุขภาพ แจ้งปัญหา และขอคำปรึกษา

Webhook ตรวจ `x-line-signature` ทุกครั้งและเก็บเฉพาะ metadata ที่จำเป็นเพื่อกัน event ซ้ำ ส่วน Vercel Cron เรียก `/api/jobs/reminders` เวลา 08:00 น. ประเทศไทยทุกวัน เพื่อส่งข้อความเตือนนัดวันถัดไปแบบไม่ส่งซ้ำ

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
