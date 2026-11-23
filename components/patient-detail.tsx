"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarPlus, CircleAlert, LoaderCircle, Pencil, RotateCcw, Save, UserRoundCheck } from "lucide-react";
import { LineLinkInvite } from "@/components/line-link-invite";
import { Modal } from "@/components/modal";

type Appointment = {
  id: string;
  appointmentAt: string;
  clinic: string;
  status: string;
  attendedAt: string | null;
  missedMarkedAt: string | null;
  followUp: { id: string; status: string; priority: string; missedReason: string | null; assigneeName: string | null } | null;
};

type Detail = {
  patient: { id: string; hn: string; fullName: string; phone: string | null; village: string | null; birthDate: string | null; contactPreference: string; assignedVolunteerId: string | null; assigneeName: string | null };
  line: { linked: boolean; displayName: string | null };
  appointments: Appointment[];
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "นัดปกติ",
  missed: "ขาดนัด",
  attended: "มาแล้ว",
  rescheduled: "นัดใหม่",
  cancelled: "ยกเลิก"
};
const FOLLOWUP_LABEL: Record<string, string> = {
  pending: "รอติดตาม",
  assigned: "กำลังติดตาม",
  contacted: "ติดต่อแล้ว",
  rescheduled: "นัดใหม่แล้ว",
  returned: "กลับมารับบริการ",
  closed: "ปิดเคส"
};

function thaiDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(date);
}

export function PatientDetail({ id }: { id: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // edit form
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [village, setVillage] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [saving, setSaving] = useState(false);

  // add appointment form
  const [showAdd, setShowAdd] = useState(false);
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("08:00");
  const [apptClinic, setApptClinic] = useState("คลินิกความดัน");
  const [apptStatus, setApptStatus] = useState<"scheduled" | "missed">("scheduled");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [volunteers, setVolunteers] = useState<Array<{ id: string; full_name: string; active: boolean }>>([]);
  const [selectedVolunteer, setSelectedVolunteer] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/patients/${id}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "ไม่พบผู้ป่วย");
      setDetail(body);
      setFullName(body.patient.fullName ?? "");
      setPhone(body.patient.phone ?? "");
      setVillage(body.patient.village ?? "");
      setBirthDate(body.patient.birthDate ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetch("/api/volunteers").then((response) => response.json()).then((body) => {
      setVolunteers((body.volunteers ?? []).filter((volunteer: { active: boolean }) => volunteer.active));
    }).catch(() => {});
  }, []);

  async function assign() {
    if (!detail || !selectedVolunteer) return;
    setAssigning(true);
    setAssignMessage(null);
    try {
      const response = await fetch(`/api/patients/${id}/assign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ volunteerId: selectedVolunteer })
      });
      const body = await response.json();
      if (!response.ok) {
        setAssignMessage(body.error ?? "มอบหมายไม่สำเร็จ");
      } else {
        setAssignMessage(`มอบหมายแล้ว${body.assigned_follow_ups ? ` (อัปเดตเคสติดตาม ${body.assigned_follow_ups} ราย)` : ""}`);
        await load();
      }
    } catch {
      setAssignMessage("มอบหมายไม่สำเร็จ");
    } finally {
      setAssigning(false);
    }
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(`/api/patients/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName, phone, village, birthDate })
      });
      if (!response.ok) throw new Error("บันทึกไม่สำเร็จ");
      setEditing(false);
      await load();
    } catch {
      setFormError("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function addAppointment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdding(true);
    setFormError(null);
    try {
      const response = await fetch(`/api/patients/${id}/appointments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appointmentDate: apptDate, appointmentTime: apptTime, clinic: apptClinic, status: apptStatus })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "เพิ่มนัดไม่สำเร็จ");
      setShowAdd(false);
      await load();
    } catch (addError) {
      setFormError(addError instanceof Error ? addError.message : "เพิ่มนัดไม่สำเร็จ");
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return <div className="page-shell"><div className="state-banner" role="status"><LoaderCircle className="spin" size={18} /><span>กำลังโหลดผู้ป่วย…</span></div></div>;
  }
  if (error || !detail) {
    return <div className="page-shell"><div className="state-banner error" role="alert"><CircleAlert size={18} /><span>{error ?? "ไม่พบผู้ป่วย"}</span><button className="button secondary" onClick={() => void load()}><RotateCcw size={16} />ลองใหม่</button></div></div>;
  }

  return (
    <div className="page-shell">
      <div className="page-heading compact">
        <div className="patient-detail-title">
          <span className="patient-detail-avatar" aria-hidden="true">{detail.patient.fullName.slice(0, 1)}</span>
          <div>
          <p className="eyebrow">ผู้ป่วย</p>
          <h1>{detail.patient.fullName}</h1>
          <p>HN {detail.patient.hn} · {detail.patient.village ?? "ไม่ระบุหมู่บ้าน"}{detail.patient.phone ? ` · ${detail.patient.phone}` : ""}</p>
          </div>
        </div>
        <div className="patient-detail-actions">
          <Link className="button secondary" href="/patients"><ArrowLeft size={16} /> ทะเบียนผู้ป่วย</Link>
          <button className="button secondary" onClick={() => setEditing(true)}><Pencil size={16} /> แก้ไขข้อมูล</button>
        </div>
      </div>

      <Modal open={editing} onClose={() => { if (!saving) setEditing(false); }} title="แก้ไขข้อมูลผู้ป่วย" description={`HN ${detail.patient.hn}`}>
          <form onSubmit={saveEdit} className="case-form">
            {formError && <div className="state-banner error" role="alert"><span>{formError}</span></div>}
            <div className="two-fields">
              <label className="field"><span>ชื่อ-นามสกุล</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} required autoFocus /></label>
              <label className="field"><span>เบอร์โทร</span><input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            </div>
            <div className="two-fields">
              <label className="field"><span>หมู่บ้าน</span><input value={village} onChange={(event) => setVillage(event.target.value)} /></label>
              <label className="field"><span>วันเกิด</span><input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label>
            </div>
            <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setEditing(false)} disabled={saving}>ยกเลิก</button><button className="button primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} บันทึก</button></div>
          </form>
      </Modal>

      <div className="patient-detail-grid">
        <aside className="patient-side-stack">
        <section className="panel case-summary">
          <h2>อสม. รับผิดชอบ</h2>
          <p>ผู้รับผิดชอบ: {detail.patient.assigneeName ?? "ยังไม่มอบหมาย"}</p>
          <div className="case-form">
            <label className="field"><span>เลือก อสม.</span>
              <select value={selectedVolunteer} onChange={(event) => setSelectedVolunteer(event.target.value)}>
                <option value="">— เลือก อสม. —</option>
                {volunteers.map((volunteer) => <option key={volunteer.id} value={volunteer.id}>{volunteer.full_name}</option>)}
              </select>
            </label>
            <button className="button primary" onClick={() => void assign()} disabled={!selectedVolunteer || assigning}>{assigning ? <LoaderCircle className="spin" size={16} /> : "มอบหมาย/เปลี่ยน อสม."}</button>
          </div>
          {assignMessage && <p className="form-error" role="status">{assignMessage}</p>}
        </section>

        <section className="panel case-summary">
          <h2>เชื่อมบัญชี LINE</h2>
          <p>{detail.line.linked ? `เชื่อมแล้ว${detail.line.displayName ? ` (${detail.line.displayName})` : ""}` : "ยังไม่ผูกบัญชี LINE"}</p>
          <LineLinkInvite targetType="patient" targetId={detail.patient.id} role="patient" label={detail.line.linked ? "สร้างรหัสใหม่" : "สร้างรหัสเชื่อม LINE"} />
        </section>
        </aside>

        <section className="panel case-summary patient-appointments">
          <div className="panel-head">
            <div><h2>นัดทั้งหมด</h2><p>นัด {detail.appointments.length} รายการ</p></div>
            <button className="button secondary" onClick={() => setShowAdd(true)}><CalendarPlus size={16} /> เพิ่มนัด</button>
          </div>

          {detail.appointments.length === 0 ? (
            <div className="state-banner empty"><span>ยังไม่มีนัด</span></div>
          ) : (
            <ol className="timeline">
              {detail.appointments.map((appointment) => (
                <li key={appointment.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{appointment.clinic} · {thaiDateTime(appointment.appointmentAt)}</strong>
                    <small>{STATUS_LABEL[appointment.status] ?? appointment.status}</small>
                    {appointment.followUp && (
                      <p>ติดตาม: {FOLLOWUP_LABEL[appointment.followUp.status] ?? appointment.followUp.status}
                        {appointment.followUp.assigneeName ? ` · อสม. ${appointment.followUp.assigneeName}` : ""}
                        {appointment.followUp.missedReason ? ` · ${appointment.followUp.missedReason}` : ""}
                        <Link className="text-link" href={`/follow-up/${appointment.followUp.id}`}> เปิดเคสติดตาม ›</Link>
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      <Modal open={showAdd} onClose={() => { if (!adding) setShowAdd(false); }} title="เพิ่มนัดใหม่" description={`ผู้ป่วย ${detail.patient.fullName} · HN ${detail.patient.hn}`} size="sm">
        <form onSubmit={addAppointment} className="case-form">
          {formError && <div className="state-banner error" role="alert"><span>{formError}</span></div>}
          <div className="two-fields">
            <label className="field"><span>วันที่นัด</span><input type="date" value={apptDate} onChange={(event) => setApptDate(event.target.value)} required autoFocus /></label>
            <label className="field"><span>เวลานัด</span><input type="time" value={apptTime} onChange={(event) => setApptTime(event.target.value)} required /></label>
          </div>
          <label className="field"><span>คลินิก</span><input value={apptClinic} onChange={(event) => setApptClinic(event.target.value)} required /></label>
          <label className="field"><span>สถานะ</span><select value={apptStatus} onChange={(event) => setApptStatus(event.target.value as "scheduled" | "missed")}><option value="scheduled">นัดปกติ</option><option value="missed">ขาดนัด (สร้างติดตามทันที)</option></select></label>
          {apptStatus === "missed" && <div className="modal-callout"><CircleAlert size={18} /><p>ระบบจะสร้างเคสติดตามทันทีหลังบันทึกนัด</p></div>}
          <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setShowAdd(false)} disabled={adding}>ยกเลิก</button><button className="button primary" disabled={adding}>{adding ? <><LoaderCircle className="spin" size={16} />กำลังเพิ่ม</> : "เพิ่มนัด"}</button></div>
        </form>
      </Modal>
    </div>
  );
}
