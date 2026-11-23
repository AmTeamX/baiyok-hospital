"use client";

import { HeartPulse, Stethoscope } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { VolunteerTaskItem } from "@/components/volunteer-task-list";

export default function LiffVolunteerContactNursePage() {
  const [tasks, setTasks] = useState<VolunteerTaskItem[]>([]);
  const [selected, setSelected] = useState("");
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "done">("loading");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const response = await fetch("/api/volunteer/tasks?filter=open");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "unauthorized");
      setTasks(body.tasks ?? []);
      const preset = new URLSearchParams(window.location.search).get("task");
      if (preset) setSelected(preset);
      setPhase("ready");
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "โหลดงานไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const detail = await fetch(`/api/volunteer/tasks/${selected}`).then((response) => response.json());
      if (!detail.ok) throw new Error(detail.error ?? "not_found");

      const response = await fetch(`/api/volunteer/tasks/${selected}/escalate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note, expectedVersion: detail.task.version })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "ส่งคำขอไม่สำเร็จ");
      setPhase("done");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ส่งคำขอไม่สำเร็จ");
      setPhase("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="patient-page">
      <header className="patient-brand">
        <span><HeartPulse /> ติดต่อพยาบาล</span>
        <small><a href="/liff/volunteer">งานของฉัน</a></small>
      </header>

      <main className="patient-content volunteer-detail">
        {phase === "loading" && <p className="volunteer-hint">กำลังโหลด…</p>}

        {phase === "done" && (
          <section className="appointment-hero">
            <h2>ส่งคำขอแล้ว</h2>
            <p>พยาบาลจะเห็นงานนี้เป็นงานเร่งด่วนและประสานงานต่อ</p>
            <a className="button patient-primary" href="/liff/volunteer">กลับไปงานของฉัน</a>
          </section>
        )}

        {phase === "error" && (
          <section className="appointment-hero">
            <h2>ไม่สามารถส่งคำขอได้</h2>
            <p>{message}</p>
            <button className="button patient-primary" onClick={() => void load()}>ลองใหม่</button>
          </section>
        )}

        {phase === "ready" && (
          <>
            <section className="appointment-hero">
              <h2>ขอให้พยาบาลช่วยประสาน</h2>
              <p>เลือกงานที่ต้องการให้พยาบาลช่วย และระบุรายละเอียดที่จำเป็น</p>
            </section>

            {tasks.length === 0 ? (
              <p className="volunteer-hint">ไม่มีงานที่ยังเปิดอยู่</p>
            ) : (
              <div className="volunteer-form">
                <label className="field">
                  เลือกงาน
                  <select value={selected} onChange={(event) => setSelected(event.target.value)}>
                    <option value="">— เลือกงาน —</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>{task.patient.fullName} · {task.appointment.clinic}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  รายละเอียดสำหรับพยาบาล
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="ระบุสิ่งที่ต้องการให้พยาบาลช่วย (ถ้ามี)" />
                </label>
                <button className="button primary" disabled={!selected || submitting} onClick={() => void submit()}>
                  {submitting ? "กำลังส่ง…" : "ส่งคำขอถึงพยาบาล"}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
