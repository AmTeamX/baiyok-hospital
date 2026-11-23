"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { MissedPatient } from "@/lib/demo-data";

type Volunteer = { id: string; full_name: string; active: boolean; phone: string | null };

const reasons = ["ลืมวันนัด", "เดินทางไม่สะดวก", "ไม่มีอาการจึงคิดว่าหาย", "กังวลค่าใช้จ่าย", "ติดงาน/ดูแลครอบครัว", "มีอาการป่วยอื่น", "อื่น ๆ"];
const activities = ["โทรศัพท์ติดตาม", "มอบหมาย อสม. เยี่ยมบ้าน", "ให้คำปรึกษาเรื่องยา", "ให้สื่อสุขภาพ", "ประสานคลินิกนัดใหม่"];

export function FollowUpForm({ patient }: { patient: MissedPatient }) {
  const [step, setStep] = useState(1); const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [volunteers, setVolunteers] = useState<Volunteer[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/volunteers").then((response) => response.json()).then((body) => {
      if (!cancelled) setVolunteers((body.volunteers ?? []).filter((volunteer: Volunteer) => volunteer.active));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); const form = new FormData(event.currentTarget); const response = await fetch("/api/follow-ups", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) }); setSaving(false); if (response.ok) { setSaved(true); setStep(4); } }
  return <form className="followup-workbench" onSubmit={submit}>
    <input type="hidden" name="appointment_id" value={patient.id} />
    <ol className="stepper" aria-label="ขั้นตอนบันทึก"><li className={step >= 1 ? "active" : ""}><span>1</span>ประเมินสาเหตุ</li><li className={step >= 2 ? "active" : ""}><span>2</span>กิจกรรมพยาบาล</li><li className={step >= 3 ? "active" : ""}><span>3</span>นัดใหม่</li><li className={step >= 4 ? "active" : ""}><span>4</span>ยืนยันผล</li></ol>
    <div className="form-columns">
      <section className="panel form-section"><h2>เหตุผลที่ขาดนัด</h2><p>เลือกเหตุผลหลักจากการพูดคุยกับผู้ป่วยหรือญาติ</p><div className="choice-grid">{reasons.map(reason => <label key={reason}><input type="radio" name="reason" value={reason} required onChange={() => setStep(Math.max(step, 2))} /><span>{reason}</span></label>)}</div><label className="field"><span>รายละเอียดเพิ่มเติม</span><textarea name="reason_note" placeholder="สิ่งที่ผู้ป่วยเล่า หรือข้อจำกัดที่พบ" /></label></section>
      <section className="panel form-section"><h2>กิจกรรมที่ดำเนินการ</h2><p>เลือกได้มากกว่าหนึ่งข้อ</p><div className="check-list">{activities.map(activity => <label key={activity}><input type="checkbox" name={`activity_${activity}`} value="yes" onChange={() => setStep(Math.max(step, 3))} /><span><Check size={16} />{activity}</span></label>)}</div><label className="field"><span>บันทึกคำปรึกษา</span><textarea name="counselling_note" placeholder="ประเด็นที่ให้คำแนะนำและการตอบสนองของผู้ป่วย" /></label></section>
      <section className="panel form-section"><h2>นัดใหม่และผลติดตาม</h2><div className="two-fields"><label className="field"><span>วันที่นัดใหม่</span><input name="new_appointment_date" type="date" /></label><label className="field"><span>เวลา</span><input name="new_appointment_time" type="time" /></label></div><label className="field"><span>มอบหมาย อสม.</span><select name="volunteer_id"><option value="">ยังไม่มอบหมาย</option>{volunteers.map((volunteer) => <option key={volunteer.id} value={volunteer.id}>{volunteer.full_name}</option>)}</select></label><label className="field"><span>ระดับความเร่งด่วน</span><select name="priority" defaultValue="normal"><option value="normal">ปกติ</option><option value="high">เร่งด่วน</option><option value="urgent">ฉุกเฉิน</option></select></label><fieldset className="field"><legend>การกลับมารับบริการ</legend><label className="inline-choice"><input type="radio" name="returned" value="yes" /> กลับมาแล้ว</label><label className="inline-choice"><input type="radio" name="returned" value="no" /> ยังไม่กลับมา</label><label className="inline-choice"><input type="radio" name="returned" value="unknown" defaultChecked /> รอตรวจสอบ</label></fieldset></section>
    </div>
    <div className={`save-bar ${saved ? "success" : ""}`}><span>{saved ? "บันทึกแล้ว สามารถกลับมาตรวจสอบและยืนยันผลภายหลังได้" : "ระบบจะไม่เปลี่ยนวันนัดจนกว่าเจ้าหน้าที่จะบันทึก"}</span><button className={`button primary ${saving ? "loading" : ""}`} disabled={saving}>{saving ? <><LoaderCircle className="spin" size={18} />กำลังบันทึก</> : saved ? "บันทึกสำเร็จ" : "บันทึกการติดตาม"}</button></div>
  </form>;
}
