"use client";

import { CalendarDays, Clock3, HeartPulse, Hospital } from "lucide-react";
import { useEffect, useState } from "react";

type Appointment = { id: string; appointmentAt: string; clinic: string; status: string };

function historyLabel(status: string) {
  if (status === "missed") return "ขาดนัด";
  if (status === "attended") return "เข้ารับบริการแล้ว";
  if (status === "cancelled") return "ยกเลิกนัด";
  return "นัดที่ผ่านมา";
}

function parts(iso: string) {
  const date = new Date(iso);
  return {
    day: new Intl.DateTimeFormat("th-TH", { day: "numeric", timeZone: "Asia/Bangkok" }).format(date),
    monthYear: new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(date),
    time: new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(date)
  };
}

export default function LiffAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/patient/me/appointments");
        const body = await response.json();
        if (response.status === 401 || response.status === 403) {
          window.location.href = "/liff/context";
          return;
        }
        if (!response.ok) throw new Error(body.error ?? "unauthorized");
        setAppointments(body.appointments ?? []);
        setHistory(body.history ?? []);
        setPhase("ready");
      } catch (error) {
        setPhase("error");
        setMessage(error instanceof Error ? error.message : "โหลดวันนัดไม่สำเร็จ");
      }
    })();
  }, []);

  const next = appointments[0];

  return (
    <div className="patient-page">
      <header className="patient-brand"><span><HeartPulse /> รพ.สต. สระโคล่</span><small>วันนัดของฉัน</small></header>
      <main className="patient-content">
        {phase === "loading" && <p className="volunteer-hint">กำลังโหลด…</p>}

        {phase === "error" && (
          <section className="appointment-hero">
            <h2>โหลดวันนัดไม่สำเร็จ</h2>
            <p>{message}</p>
            <a className="button patient-primary" href="/liff/context">กลับไปเลือกโหมด</a>
          </section>
        )}

        {phase === "ready" && (
          <>
            {next ? (
              <>
                <section className="appointment-hero">
                  <p>นัดครั้งถัดไปของคุณ</p>
                  <div className="date-block"><strong>{parts(next.appointmentAt).day}</strong><span>{parts(next.appointmentAt).monthYear}</span></div>
                  <div className="appointment-meta">
                    <span><Clock3 /> {parts(next.appointmentAt).time} น.</span>
                    <span><Hospital /> {next.clinic} รพ.สต. สระโคล่</span>
                  </div>
                  <a className="button patient-primary" href={`/api/calendar?date=${encodeURIComponent(next.appointmentAt)}`}><CalendarDays /> เพิ่มเตือนในปฏิทิน</a>
                </section>
                <div className="patient-actions"><a href={`/liff/problem?appointmentId=${encodeURIComponent(next.id)}&type=reschedule`}><span><CalendarDays /></span><div><strong>ขอเลื่อนนัด</strong><small>ส่งคำขอพร้อมลิงก์นัดนี้ให้เจ้าหน้าที่</small></div><span>›</span></a><a href="/liff/consult"><span><HeartPulse /></span><div><strong>ปรึกษาพยาบาล</strong><small>เรื่องยาและการดูแลตัวเอง</small></div><span>›</span></a></div>
              </>
            ) : (
              <section className="appointment-hero">
                <h2>ยังไม่มีนัดถัดไป</h2>
                <p>หากมีข้อสงสัยเรื่องนัด กรุณาติดต่อหน่วยบริการ</p>
                <a className="button patient-primary" href="/liff/consult">ติดต่อเจ้าหน้าที่</a>
              </section>
            )}
            {appointments.length > 1 && (
              <section>
                <h2>นัดถัด ๆ ไป</h2>
                <ul className="volunteer-task-list">
                  {appointments.slice(1).map((appointment) => (
                    <li key={appointment.id} className="volunteer-task">
                      <div className="volunteer-task-main">
                        <strong>{appointment.clinic}</strong>
                        <small>{parts(appointment.appointmentAt).day} {parts(appointment.appointmentAt).monthYear} · {parts(appointment.appointmentAt).time} น.</small>
                        <a className="text-link" href={`/liff/problem?appointmentId=${encodeURIComponent(appointment.id)}&type=reschedule`}>ขอเลื่อนนัดนี้ ›</a>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {history.length > 0 && (
              <section>
                <h2>นัดที่ผ่านมา</h2>
                <ul className="volunteer-task-list">
                  {history.map((appointment) => (
                    <li key={appointment.id} className="volunteer-task">
                      <div className="volunteer-task-main">
                        <strong>{appointment.clinic}</strong>
                        <small>{parts(appointment.appointmentAt).day} {parts(appointment.appointmentAt).monthYear} · {parts(appointment.appointmentAt).time} น.</small>
                        <div className="volunteer-task-badges"><span className="badge status-volunteer">{historyLabel(appointment.status)}</span></div>
                      </div>
                      {appointment.status === "missed" || appointment.status === "scheduled" ? (
                        <a className="button patient-primary" href={`/liff/problem?appointmentId=${encodeURIComponent(appointment.id)}`}>แจ้งปัญหาเรื่องนัดนี้</a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
