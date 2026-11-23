"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CircleAlert, LoaderCircle, Pencil, RotateCcw, Search, XCircle } from "lucide-react";
import { Modal } from "@/components/modal";

type Appointment = {
  id: string;
  appointmentAt: string;
  clinic: string;
  status: string;
  attendedAt: string | null;
  missedMarkedAt: string | null;
  patient: { id: string; hn: string; fullName: string; phone: string | null; village: string | null };
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "นัดปกติ",
  missed: "ขาดนัด",
  attended: "มาแล้ว",
  rescheduled: "นัดใหม่",
  cancelled: "ยกเลิก"
};

function thaiDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok"
  }).format(date);
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  return formatter.format(date).replace(" ", "T");
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [appointmentAt, setAppointmentAt] = useState("");
  const [clinic, setClinic] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (status !== "all") params.set("status", status);
      const response = await fetch(`/api/appointments?${params.toString()}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "โหลดรายการนัดไม่สำเร็จ");
      setAppointments(body.appointments ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดรายการนัดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    void load();
  }, [load]);

  function openEdit(appointment: Appointment) {
    setSelected(appointment);
    setAppointmentAt(toDateTimeLocal(appointment.appointmentAt));
    setClinic(appointment.clinic);
    setFormError(null);
  }

  async function saveAppointment() {
    if (!selected) return;
    setSaving(true);
    setFormError(null);
    try {
      const date = new Date(`${appointmentAt}:00+07:00`);
      if (Number.isNaN(date.getTime())) throw new Error("กรุณากรอกวันและเวลานัดให้ถูกต้อง");
      const response = await fetch(`/api/appointments/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appointmentAt: date.toISOString(), clinic, status: "scheduled" })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "บันทึกนัดไม่สำเร็จ");
      setSelected(null);
      await load();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "บันทึกนัดไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function cancelAppointment(appointment: Appointment) {
    if (!window.confirm(`ยกเลิกนัดของ ${appointment.patient.fullName} เมื่อ ${thaiDateTime(appointment.appointmentAt)} หรือไม่?`)) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "cancelled" })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "ยกเลิกนัดไม่สำเร็จ");
      await load();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "ยกเลิกนัดไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div><p className="eyebrow">คำขอนัดและกำหนดการ</p><h1>จัดการนัดผู้ป่วย</h1><p>ย้ายหรือยกเลิกนัดเมื่อผู้ป่วยเปลี่ยนแผน หรือไม่สะดวกมา</p></div>
      </div>

      <section className="panel">
        <div className="patient-registry-head">
          <div><span className="registry-kicker">รายการนัด</span><strong>{loading ? "—" : appointments.length.toLocaleString("th-TH")} รายการ</strong></div>
          <form className="patient-search" onSubmit={(event) => { event.preventDefault(); void load(); }} role="search">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อผู้ป่วย, HN หรือคลินิก" aria-label="ค้นหารายการนัด" />
            <button className="button primary" type="submit">ค้นหา</button>
          </form>
        </div>
        <div className="patient-filterbar">
          <div className="patient-filterset" aria-label="กรองสถานะนัด">
            {[["all", "ทั้งหมด"], ["scheduled", "นัดปกติ"], ["attended", "มาแล้ว"], ["missed", "ขาดนัด"], ["cancelled", "ยกเลิก"]].map(([value, label]) => (
              <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>
            ))}
          </div>
        </div>

        {error && <div className="state-banner error" role="alert"><CircleAlert size={18} /><span>{error}</span><button className="button secondary" onClick={() => void load()}><RotateCcw size={16} />ลองใหม่</button></div>}

        {loading ? (
          <div className="state-banner" role="status"><LoaderCircle className="spin" size={18} />กำลังโหลดรายการนัด…</div>
        ) : appointments.length === 0 ? (
          <div className="patient-empty"><CalendarDays size={28} /><strong>ไม่พบรายการนัด</strong><p>ลองเปลี่ยนคำค้นหรือสถานะนัด</p></div>
        ) : (
          <div className="patient-list">
            <div className="patient-list-header" aria-hidden="true"><span>ผู้ป่วย</span><span>วันและเวลานัด</span><span>คลินิก</span><span>สถานะ</span><span /></div>
            {appointments.map((appointment) => (
              <article className="patient-registry-row" key={appointment.id}>
                <div className="patient-identity">
                  <span className="patient-initial" aria-hidden="true">{appointment.patient.fullName.slice(0, 1)}</span>
                  <span><Link href={`/patients/${appointment.patient.id}`}>{appointment.patient.fullName}</Link><small>HN {appointment.patient.hn}{appointment.patient.phone ? ` · ${appointment.patient.phone}` : ""}</small></span>
                </div>
                <div className="patient-latest"><strong><CalendarDays size={16} />{thaiDateTime(appointment.appointmentAt)}</strong><small>{appointment.patient.village ?? "ไม่ระบุหมู่บ้าน"}</small></div>
                <div className="patient-contact"><strong>{appointment.clinic}</strong></div>
                <div><i className={`status-dot status-${appointment.status}`}>{STATUS_LABEL[appointment.status] ?? appointment.status}</i></div>
                <div className="patient-nav-actions">
                  {appointment.status !== "cancelled" && appointment.status !== "attended" && (
                    <>
                      <button className="icon-button" type="button" onClick={() => openEdit(appointment)} aria-label={`ย้ายนัด ${appointment.patient.fullName}`} title="ย้ายนัด"><Pencil size={17} /></button>
                      <button className="icon-button" type="button" disabled={saving} onClick={() => void cancelAppointment(appointment)} aria-label={`ยกเลิกนัด ${appointment.patient.fullName}`} title="ยกเลิกนัด"><XCircle size={17} /></button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Modal open={Boolean(selected)} onClose={() => { if (!saving) setSelected(null); }} title="ย้ายวันนัด" description={selected ? `ผู้ป่วย ${selected.patient.fullName} · HN ${selected.patient.hn}` : ""} size="sm">
        <form onSubmit={(event) => { event.preventDefault(); void saveAppointment(); }} className="case-form">
          {formError && <div className="state-banner error" role="alert"><span>{formError}</span></div>}
          <label className="field"><span>วันและเวลานัดใหม่</span><input type="datetime-local" value={appointmentAt} onChange={(event) => setAppointmentAt(event.target.value)} required autoFocus /></label>
          <label className="field"><span>คลินิก</span><input value={clinic} onChange={(event) => setClinic(event.target.value)} required /></label>
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={() => setSelected(null)} disabled={saving}>ยกเลิก</button>
            <button className="button primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : null}บันทึกนัดใหม่</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
