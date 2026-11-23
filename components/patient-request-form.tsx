"use client";

import { useState } from "react";
import {
  PATIENT_REQUEST_REASONS,
  PATIENT_REQUEST_REASON_LABELS,
  PATIENT_REQUEST_TYPE_LABELS,
  type PatientRequestType
} from "@/lib/patient";

export function PatientRequestForm({ type, appointmentId, requestTypeLabel }: { type: PatientRequestType; appointmentId?: string; requestTypeLabel?: string }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState<"ready" | "busy" | "done" | "error">("ready");
  const [message, setMessage] = useState("");

  async function submit() {
    if (!reason) return;
    setPhase("busy");
    try {
      const response = await fetch("/api/patient/me/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestType: type, reasonCode: reason, note, appointmentId })
      });
      const body = await response.json();
      if (response.status === 401 || response.status === 403) {
        window.location.href = "/liff/context";
        return;
      }
      if (!response.ok) throw new Error(body.error ?? "ส่งคำขอไม่สำเร็จ");
      setPhase("done");
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "ส่งคำขอไม่สำเร็จ");
    }
  }

  return (
    <main className="patient-content volunteer-detail">
      {phase === "done" && (
        <section className="appointment-hero">
          <h2>รับเรื่องแล้ว</h2>
          <p>เจ้าหน้าที่จะติดต่อกลับ ระบบจะไม่เปลี่ยนวันนัดให้อัตโนมัติ</p>
          <a className="button patient-primary" href="/liff/appointments">กลับไปวันนัดของฉัน</a>
        </section>
      )}

      {phase === "error" && (
        <section className="appointment-hero">
          <h2>ส่งคำขอไม่สำเร็จ</h2>
          <p>{message}</p>
          <button className="button patient-primary" onClick={() => setPhase("ready")}>ลองใหม่</button>
        </section>
      )}

      {phase !== "done" && phase !== "error" && (
        <>
          <section className="appointment-hero">
            <h2>{requestTypeLabel ?? PATIENT_REQUEST_TYPE_LABELS[type]}</h2>
            <p>{appointmentId ? "คำขอนี้จะผูกกับนัดที่คุณเลือกไว้ เจ้าหน้าที่จะเลื่อนหรือยกเลิกนัดให้หลังจากประสานแล้ว" : "เลือกเหตุผลที่ตรงกับคุณที่สุด ระบบจะส่งเรื่องให้เจ้าหน้าที่ติดต่อกลับ"}</p>
          </section>

          <fieldset className="volunteer-result-grid">
            <legend>เหตุผล</legend>
            {PATIENT_REQUEST_REASONS[type].map((code) => (
              <label key={code}>
                <input type="radio" name="reason" value={code} checked={reason === code} onChange={() => setReason(code)} />
                <span>{PATIENT_REQUEST_REASON_LABELS[code]}</span>
              </label>
            ))}
          </fieldset>

          <div className="volunteer-form">
            <label className="field">
              รายละเอียดเพิ่มเติม
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="บอกช่วงเวลาที่สะดวกให้ติดต่อกลับ หรือรายละเอียดเพิ่มเติม (ถ้ามี)" />
            </label>
          </div>

          <div className="volunteer-save-bar">
            <p>ข้อมูลนี้จะไม่ถูกนำไปเปลี่ยนวันนัดโดยอัตโนมัติ</p>
            <button className="button primary" disabled={!reason || phase === "busy"} onClick={() => void submit()}>
              {phase === "busy" ? "กำลังส่ง…" : "ส่งเรื่องให้เจ้าหน้าที่"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
