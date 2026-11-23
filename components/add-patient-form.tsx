"use client";

import { LoaderCircle, Save, UserPlus } from "lucide-react";
import { useState } from "react";

export function AddPatientForm() {
  const [hn, setHn] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [village, setVillage] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("08:00");
  const [clinic, setClinic] = useState("คลินิกความดัน");
  const [status, setStatus] = useState<"scheduled" | "missed">("scheduled");

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
        body: JSON.stringify({ hn, fullName, phone, village, appointmentDate, appointmentTime, clinic, status })
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
    <form onSubmit={submit} className="case-form">
      {phase === "error" && <div className="state-banner error" role="alert"><span>{message}</span></div>}

      <div className="two-fields">
        <label className="field"><span>HN</span><input value={hn} onChange={(event) => setHn(event.target.value)} required placeholder="เลขนำหน้า 0 จะถูกรักษาไว้" /></label>
        <label className="field"><span>ชื่อ-นามสกุล</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>
      </div>
      <div className="two-fields">
        <label className="field"><span>เบอร์โทร</span><input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <label className="field"><span>หมู่บ้าน</span><input value={village} onChange={(event) => setVillage(event.target.value)} /></label>
      </div>
      <div className="two-fields">
        <label className="field"><span>วันที่นัด</span><input type="date" value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} required /></label>
        <label className="field"><span>เวลานัด</span><input type="time" value={appointmentTime} onChange={(event) => setAppointmentTime(event.target.value)} required /></label>
      </div>
      <label className="field"><span>คลินิก</span><input value={clinic} onChange={(event) => setClinic(event.target.value)} required /></label>
      <label className="field">
        <span>สถานะ</span>
        <select value={status} onChange={(event) => setStatus(event.target.value as "scheduled" | "missed")}>
          <option value="scheduled">นัดปกติ (ยังไม่ขาดนัด)</option>
          <option value="missed">ขาดนัด (สร้างรายการติดตามทันที)</option>
        </select>
      </label>
      {status === "missed" && <p className="volunteer-hint">จะสร้างเป็นผู้ขาดนัดพร้อมรายการติดตามให้ทันที ปรากฏในทะเบียนผู้ขาดนัด</p>}

      <button className="button primary" disabled={phase === "saving"}>{phase === "saving" ? <><LoaderCircle className="spin" size={18} />กำลังบันทึก</> : <><Save size={18} />บันทึกผู้ป่วยและนัด</>}</button>
    </form>
  );
}
