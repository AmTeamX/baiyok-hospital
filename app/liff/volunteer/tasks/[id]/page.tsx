"use client";

import { useParams } from "next/navigation";
import { HeartPulse, MapPin, Phone, Stethoscope } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import {
  VOLUNTEER_CHANNEL_LABELS,
  VOLUNTEER_CHANNELS,
  VOLUNTEER_RESULT_CODES,
  VOLUNTEER_RESULT_LABELS,
  resultCodeEscalates,
  volunteerLoadErrorMessage,
  type VolunteerChannel,
  type VolunteerResultCode
} from "@/lib/volunteer";
import type { VolunteerTaskItem } from "@/components/volunteer-task-list";

type TaskDetail = VolunteerTaskItem & { version: number };

function thaiDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "ไม่ระบุวันนัด" : new Intl.DateTimeFormat("th-TH", { dateStyle: "full", timeZone: "Asia/Bangkok" }).format(date);
}

export default function VolunteerTaskDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  const [resultCode, setResultCode] = useState<VolunteerResultCode | "">("");
  const [channel, setChannel] = useState<VolunteerChannel>("phone");
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [done, setDone] = useState<"result" | "escalated" | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setPhase("loading");
    try {
      const response = await fetch(`/api/volunteer/tasks/${id}`);
      const body = await response.json();
      if (response.status === 401 || (response.status === 403 && body.error === "context_required")) {
        window.location.replace(`/liff/link?destination=${encodeURIComponent(`volunteer/tasks/${id}`)}`);
        return;
      }
      if (!response.ok) throw new Error(body.error ?? "not_found");
      if (!body.task?.patient || !body.task?.appointment) throw new Error("query_failed");
      setTask(body.task);
      setPhase("ready");
    } catch (error) {
      setPhase("error");
      const code = error instanceof Error ? error.message : "network";
      setMessage(code === "not_found" ? "ไม่พบงาน หรือคุณไม่มีสิทธิ์เข้าถึงงานนี้" : volunteerLoadErrorMessage(code));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitResult() {
    if (!task || !resultCode) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/volunteer/tasks/${id}/result`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resultCode, note, channel, expectedVersion: task.version })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "บันทึกผลไม่สำเร็จ");
      setDone("result");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกผลไม่สำเร็จ");
      setPhase("error");
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  async function submitEscalate() {
    if (!task) return;
    setEscalating(true);
    try {
      const response = await fetch(`/api/volunteer/tasks/${id}/escalate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note, expectedVersion: task.version })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "ส่งคำขอไม่สำเร็จ");
      setDone("escalated");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ส่งคำขอไม่สำเร็จ");
      setPhase("error");
    } finally {
      setEscalating(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="patient-page">
      <header className="patient-brand">
        <span><Stethoscope /> บันทึกผลติดตาม</span>
        <small><a href="/liff/volunteer">งานของฉัน</a></small>
      </header>

      <main className="patient-content volunteer-detail">
        {phase === "loading" && <p className="volunteer-hint">กำลังโหลด…</p>}

        {phase === "error" && (
          <section className="appointment-hero">
            <h2>เปิดงานไม่สำเร็จ</h2>
            <p>{message === "not_found" ? "ไม่พบงาน หรือคุณไม่มีสิทธิ์เข้าถึงงานนี้" : message}</p>
            <div style={{ display: "flex", gap: "var(--space-sm)", marginBlockStart: "var(--space-md)" }}>
              <button className="button patient-primary" onClick={() => void load()}>ลองใหม่</button>
              <a className="button patient-primary" href="/liff/volunteer">กลับไปงานของฉัน</a>
            </div>
          </section>
        )}

        {done && (
          <section className="appointment-hero">
            <h2>{done === "result" ? "บันทึกผลสำเร็จ" : "ส่งต่อพยาบาลแล้ว"}</h2>
            <p>{done === "result" ? "ผลของคุณถูกบันทึกและเจ้าหน้าที่เห็นในระบบแล้ว" : "เจ้าหน้าที่จะประสานงานต่อจากผลของคุณ"}</p>
            <a className="button patient-primary" href="/liff/volunteer">กลับไปงานของฉัน</a>
          </section>
        )}

        {phase === "ready" && task && !done && (
          <>
            <section className="appointment-hero">
              <p>งานติดตามผู้ป่วย</p>
              <h2>{task.patient.fullName}</h2>
              <div className="appointment-meta">
                <span>{task.appointment.clinic}</span>
                <span>นัด {thaiDate(task.appointment.appointmentAt)}</span>
                {task.patient.village ? <span>หมู่บ้าน {task.patient.village}</span> : null}
                {task.missedReason ? <span>เหตุผลขาดนัด: {task.missedReason}</span> : null}
              </div>
              {task.overdueSla ? <i className="late-badge large">เกินกำหนด</i> : null}
            </section>

            <section className="patient-actions">
              {task.patient.phone ? <a href={`tel:${task.patient.phone}`}><span><Phone /></span><span><strong>โทรหาผู้ป่วย</strong><small>{task.patient.phone}</small></span><span>›</span></a> : null}
              {task.patient.village ? (
                <a href={`https://maps.google.com/?q=${encodeURIComponent(task.patient.village)}`} target="_blank" rel="noreferrer">
                  <span><MapPin /></span><span><strong>เปิดแผนที่</strong><small>{task.patient.village}</small></span><span>›</span>
                </a>
              ) : null}
            </section>

            <fieldset className="volunteer-result-grid">
              <legend>ผลการติดตาม</legend>
              {VOLUNTEER_RESULT_CODES.map((code) => (
                <label key={code}>
                  <input type="radio" name="result" value={code} checked={resultCode === code} onChange={() => setResultCode(code)} />
                  <span>{VOLUNTEER_RESULT_LABELS[code]}</span>
                </label>
              ))}
            </fieldset>

            {resultCodeEscalates(resultCode as VolunteerResultCode) && (
              <div className="volunteer-protocol">
                <strong>ผู้ป่วยมีอาการที่ต้องให้พยาบาลประเมิน</strong>
                <p>กรุณาแนะนำให้ติดต่อหน่วยบริการตามช่องทางที่กำหนด ระบบจะทำเครื่องหมายเร่งด่วนให้เจ้าหน้าที่เห็นทันที</p>
              </div>
            )}

            <div className="volunteer-form">
              <label className="field">
                ช่องทางที่ติดต่อ
                <select value={channel} onChange={(event) => setChannel(event.target.value as VolunteerChannel)}>
                  {VOLUNTEER_CHANNELS.map((option) => <option key={option} value={option}>{VOLUNTEER_CHANNEL_LABELS[option]}</option>)}
                </select>
              </label>
              <label className="field">
                หมายเหตุเพิ่มเติม
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="ระบุรายละเอียดที่พยาบาลควรทราบ (ถ้ามี)" />
              </label>
            </div>

            <Modal open={confirmOpen} onClose={() => { if (!submitting) setConfirmOpen(false); }} title="ยืนยันการบันทึกผล" size="sm">
              <div className="modal-confirm">
                <p>ข้อมูลจะถูกบันทึกและไม่สามารถแก้ไขย้อนหลังได้</p>
                <div style={{ display: "flex", gap: "var(--space-sm)", marginBlockStart: "var(--space-sm)" }}>
                  <button className="button secondary" onClick={() => setConfirmOpen(false)} disabled={submitting}>ยกเลิก</button>
                  <button className="button primary" onClick={() => void submitResult()} disabled={submitting || !resultCode}>{submitting ? "กำลังบันทึก…" : "ยืนยันบันทึก"}</button>
                </div>
              </div>
            </Modal>

            <div className="volunteer-save-bar">
              <p>เลือกผลการติดตามแล้วกดบันทึก หรือส่งต่อพยาบาลหากต้องการความช่วยเหลือ</p>
              <button className="button primary" disabled={!resultCode || submitting || escalating} onClick={() => setConfirmOpen(true)}>บันทึกผล</button>
              <button className="button secondary" disabled={submitting || escalating} onClick={() => void submitEscalate()}>
                <HeartPulse /> ส่งต่อพยาบาล
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
