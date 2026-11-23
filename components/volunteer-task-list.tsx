"use client";

import Link from "next/link";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  VOLUNTEER_PRIORITY_LABELS,
  VOLUNTEER_TASK_STATUS_LABELS,
  type VolunteerTaskPriority,
  type VolunteerTaskStatus
} from "@/lib/volunteer";

export type VolunteerTaskItem = {
  id: string;
  status: VolunteerTaskStatus;
  priority: VolunteerTaskPriority;
  assignedAt: string | null;
  contactedAt: string | null;
  missedReason: string | null;
  overdueSla: boolean;
  patient: { fullName: string; village: string | null; phone: string | null };
  appointment: { appointmentAt: string; clinic: string };
};

function thaiDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

export function VolunteerTaskList({ filter }: { filter: string }) {
  const [tasks, setTasks] = useState<VolunteerTaskItem[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const response = await fetch(`/api/volunteer/tasks?filter=${encodeURIComponent(filter)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "unauthorized");
      setTasks(body.tasks ?? []);
      setPhase("ready");
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "โหลดงานไม่สำเร็จ");
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="patient-content">
      {phase === "loading" && <p className="volunteer-hint">กำลังโหลดงาน…</p>}

      {phase === "error" && (
        <section className="appointment-hero">
          <h2>ไม่สามารถโหลดงานได้</h2>
          <p>{message}</p>
          <div style={{ display: "flex", gap: "var(--space-sm)", marginBlockStart: "var(--space-md)" }}>
            <button className="button patient-primary" onClick={() => void load()}>ลองใหม่</button>
            <a className="button patient-primary" href="/liff/context">สลับโหมด</a>
          </div>
        </section>
      )}

      {phase === "ready" && tasks.length === 0 && (
        <section className="appointment-hero">
          <h2>ยังไม่มีงานในหมวดนี้</h2>
          <p>เมื่อพยาบาลมอบหมายงานให้คุณ รายการจะแสดงที่นี่</p>
        </section>
      )}

      {phase === "ready" && tasks.length > 0 && (
        <ul className="volunteer-task-list">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link className="volunteer-task" href={`/liff/volunteer/tasks/${task.id}`}>
                <span className="volunteer-task-main">
                  <strong>{task.patient.fullName}</strong>
                  <small>{task.appointment.clinic} · {thaiDate(task.appointment.appointmentAt)}</small>
                  {task.patient.village ? <small>หมู่บ้าน {task.patient.village}</small> : null}
                </span>
                <span className="volunteer-task-badges">
                  {task.priority === "urgent" ? <i className="late-badge">{VOLUNTEER_PRIORITY_LABELS.urgent}</i> : null}
                  {task.overdueSla ? <i className="late-badge"><TriangleAlert size={13} /> เกินกำหนด</i> : null}
                  <i className="status-dot status-volunteer">{VOLUNTEER_TASK_STATUS_LABELS[task.status]}</i>
                </span>
                <ChevronRight size={18} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
