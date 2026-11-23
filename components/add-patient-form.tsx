"use client";

import { LoaderCircle, Save, UserPlus } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export function AddPatientForm() {
  const [hn, setHn] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [village, setVillage] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("08:00");
  const [clinic, setClinic] = useState("คลินิกความดัน");

  const [phase, setPhase] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPhase("saving");
    setMessage("");
    try {
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hn, fullName, phone, village, appointmentDate, appointmentTime, clinic })
      });
      const body = await response.json();
      if (response.status === 409) {
        setPhase("error");
        setMessage(body.error ?? "มีนัดนี้อยู่แล้ว");
        return;
      }
      if (!response.ok) {
        setPhase("error");
        setMessage(body.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setPhase("success");
    } catch {
      setPhase("error");
      setMessage("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    }
  }

  function reset() {
    setHn(""); setFullName(""); setPhone(""); setVillage(""); setAppointmentDate(""); setAppointmentTime("08:00"); setClinic("คลินิกความดัน");
    setPhase("idle");
    setMessage("");
  }

  if (phase === "success") {
    return (
      <div className="state-banner success" role="status">
        <UserPlus size={18} />
        <span>เพิ่มผู้ป่วยและนัดเรียบร้อยแล้ว (HN {hn})</span>
        <button className="button secondary" onClick={reset}>เพิ่มอีกราย</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="case-form intake-form">
      {phase === "error" && <div className="state-banner error" role="alert"><span>{message}</span></div>}

      <fieldset className="intake-section"><legend><span>01</span>ข้อมูลผู้ป่วย</legend><p>ใช้ HN ให้ตรงกับทะเบียนหน่วยบริการ</p>
      <div className="two-fields">
        <label className="field"><span>HN *</span><input value={hn} onChange={(event) => setHn(event.target.value)} required placeholder="เช่น 0012345" /></label>
        <label className="field"><span>ชื่อ-นามสกุล</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>
      </div>
      <div className="two-fields">
        <label className="field"><span>เบอร์โทร</span><input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <label className="field"><span>หมู่บ้าน</span><input value={village} onChange={(event) => setVillage(event.target.value)} /></label>
      </div>
      </fieldset>
      <fieldset className="intake-section"><legend><span>02</span>ข้อมูลนัด</legend><p>ระบบกำหนดสถานะตามวันและเวลานัดอัตโนมัติ</p>
      <div className="two-fields">
        <label className="field"><span>วันที่นัด *</span><input type="date" value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} required /></label>
        <label className="field"><span>เวลานัด</span><input type="time" value={appointmentTime} onChange={(event) => setAppointmentTime(event.target.value)} required /></label>
      </div>
      <label className="field"><span>คลินิก</span><input value={clinic} onChange={(event) => setClinic(event.target.value)} required /></label>
      <p className="volunteer-hint">นัดที่มีวันเวลาอยู่ก่อนปัจจุบันจะถูกบันทึกเป็นขาดนัดและสร้างรายการติดตามทันที</p>

      </fieldset>
      <div className="form-action-bar"><Link className="button secondary" href="/patients">ยกเลิก</Link><button className="button primary" disabled={phase === "saving"}>{phase === "saving" ? <><LoaderCircle className="spin" size={18} />กำลังบันทึก</> : <><Save size={18} />บันทึกผู้ป่วยและนัด</>}</button></div>
    </form>
  );
}
