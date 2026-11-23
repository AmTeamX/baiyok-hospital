import { CalendarDays, ChevronRight, Clock3, HeartPulse, Hospital, MessageCircle, Pill } from "lucide-react";

export default async function PatientPage() {
  const basicId = process.env.NEXT_PUBLIC_LINE_OA_BASIC_ID;
  const consultUrl = basicId
    ? `https://line.me/R/oaMessage/${encodeURIComponent(basicId)}/?${encodeURIComponent("ขอปรึกษาพยาบาลเรื่องยาและวันนัด")}`
    : "#lesson";
  return <div className="patient-page">
    <header className="patient-brand"><span><HeartPulse /> รพ.สต. สระโคล่</span><small>ดูแลคุณ ไม่พลาดนัด</small></header>
    <main className="patient-content">
      <section className="appointment-hero"><p>นัดครั้งถัดไปของคุณ</p><div className="date-block"><strong>25</strong><span>พฤศจิกายน<small>2569</small></span></div><div className="appointment-meta"><span><Clock3 />08:30 น.</span><span><Hospital />คลินิกความดัน รพ.สต. สระโคล่</span></div><a className="button patient-primary" href="/api/calendar?date=2026-11-25T08:30:00%2B07:00"><CalendarDays />เพิ่มเตือนในปฏิทิน</a></section>
      <section className="patient-actions"><h2>เรื่องสำคัญก่อนถึงวันนัด</h2><a href="#lesson"><span><Pill /></span><strong>ไม่มีอาการ ก็ยังต้องกินยา</strong><ChevronRight /></a><a href="#lesson"><span><HeartPulse /></span><strong>ไม่หยุดยา หรือซื้อยาเอง</strong><ChevronRight /></a><a href={consultUrl}><span><MessageCircle /></span><strong>มีปัญหา ขอให้พยาบาลติดต่อกลับ</strong><ChevronRight /></a></section>
      <section id="lesson" className="patient-lesson"><h2>จำง่ายใน 1 นาที</h2><p>โรคความดันสูงอาจไม่มีอาการ แต่หลอดเลือดยังได้รับผลกระทบ การกินยาต่อเนื่องและมาตามนัดช่วยลดโอกาสเกิดอัมพฤกษ์ โรคหัวใจ และไตเสื่อม</p><fieldset><legend>ลองตอบเพื่อเช็กความเข้าใจ</legend><label><input type="radio" name="q" /> ถ้าไม่มีอาการ หยุดยาได้</label><label><input type="radio" name="q" /> ต้องกินยาตามแพทย์สั่งและมาตามนัด</label></fieldset></section>
    </main>
  </div>;
}
