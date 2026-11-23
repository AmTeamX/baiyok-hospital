"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CASE_PRIORITY_LABELS } from "@/lib/cases";

type Patient = { id: string; fullName: string; hn: string };
type Appointment = { id: string; appointmentAt: string; clinic: string; status: string; followUp: { id: string } | null };
type PatientDetail = { patient: Patient & { assigneeName: string | null }; appointments: Appointment[] };
export function CreateCase() {
  const params = useSearchParams();
  const router = useRouter();
  const [patientId, setPatientId] = useState(params.get("patientId") ?? "");
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [appointmentId, setAppointmentId] = useState("");
  const [priority, setPriority] = useState("normal");
  const [volunteerId, setVolunteerId] = useState("");
  const [volunteers, setVolunteers] = useState<{ id: string; full_name: string }[]>([]);
  const [volunteerError, setVolunteerError] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const requestedAppointment = params.get("appointmentId") ?? "";
  useEffect(() => {
    if (!requestedAppointment || params.get("patientId")) return;
    const controller = new AbortController();
    setLoading(true); setError("");
    void fetch(`/api/cases/appointment?appointmentId=${encodeURIComponent(requestedAppointment)}`, { signal: controller.signal }).then(async (r) => {
      const result = await r.json(); if (!r.ok) throw new Error(result.error);
      setPatientId(result.patientId);
    }).catch((e) => { if (!controller.signal.aborted) { setError(e.message || "โหลดนัดไม่สำเร็จ"); setLoading(false); } });
    return () => controller.abort();
  }, [requestedAppointment, params, retry]);
  useEffect(() => {
    const controller = new AbortController();
    if (!patientId) { setPatient(null); return; }
    setLoading(true); setPatient(null); setAppointmentId(""); setError("");
    void fetch(`/api/patients/${patientId}`, { signal: controller.signal }).then(async (r) => { const result = await r.json(); if (!r.ok) throw new Error("โหลดข้อมูลผู้ป่วยไม่สำเร็จ กรุณาลองใหม่"); setPatient(result); if (result.appointments.some((a: Appointment) => a.id === requestedAppointment && !a.followUp && ["scheduled", "missed"].includes(a.status))) setAppointmentId(requestedAppointment); }).catch((e) => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [patientId, retry, requestedAppointment]);
  useEffect(() => { let active = true; void fetch("/api/volunteers").then(async (r) => { const result = await r.json(); if (!r.ok || result.mode !== "database") throw new Error(); if (active) setVolunteers((result.volunteers ?? []).filter((v: { active: boolean }) => v.active)); }).catch(() => { if (active) setVolunteerError(true); }); return () => { active = false; }; }, []);
  async function search(event: React.FormEvent) {
    event.preventDefault(); if (!query.trim()) return;
    setSearching(true); setError(""); setResults(null);
    try { const response = await fetch(`/api/patients?q=${encodeURIComponent(query.trim())}`); const result = await response.json(); if (!response.ok) throw new Error("ค้นหาผู้ป่วยไม่สำเร็จ"); setResults(result.patients ?? []); }
    catch (cause) { setError((cause as Error).message); } finally { setSearching(false); }
  }
  async function create(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { const response = await fetch("/api/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appointmentId, priority, volunteerId: volunteerId || null, note }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "สร้างเคสไม่สำเร็จ"); router.push(`/follow-up/${result.id}`); }
    catch (cause) { setError((cause as Error).message); setSaving(false); }
  }
  return <div className="case-create">
    <Link className="text-link" href="/cases">← กลับจัดการเคส</Link>
    <div className="page-heading"><div><p className="eyebrow">New follow-up case</p><h1>สร้างเคสติดตาม</h1><p>หนึ่งเคสผูกกับหนึ่งนัด เลือกผู้ป่วยและนัดก่อนมอบหมายให้ อสม.</p></div></div>
    <ol className="case-steps" aria-label="ขั้นตอนสร้างเคส"><li aria-current={!patient ? "step" : undefined}><b>1</b>เลือกผู้ป่วย</li><li aria-current={patient ? "step" : undefined}><b>2</b>เลือกนัดและมอบหมาย</li></ol>
    {error && <div role="alert" className="state-banner error">{error}{patientId && !patient && !loading && <button className="button secondary" onClick={() => setRetry((v) => v + 1)}>ลองโหลดใหม่</button>}</div>}
    <section className="panel case-create-section"><h2>1. ผู้ป่วย</h2>
      {loading ? <p role="status">กำลังโหลดผู้ป่วย…</p> : patient ? <div className="case-selected-patient"><div><strong>{patient.patient.fullName}</strong><p>HN {patient.patient.hn}</p></div><button type="button" className="button secondary" disabled={saving} onClick={() => { setPatientId(""); setAppointmentId(""); setVolunteerId(""); setResults(null); setError(""); }}>เปลี่ยนผู้ป่วย</button></div> : <><form onSubmit={search} className="case-search"><label className="field">ชื่อผู้ป่วย หรือ HN<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="พิมพ์เพื่อค้นหาในทะเบียน" required /></label><button className="button secondary" disabled={searching}>{searching ? "กำลังค้นหา…" : "ค้นหา"}</button></form>{results && <div className="case-patient-results" aria-live="polite">{results.length === 0 ? <p>ไม่พบผู้ป่วย ลองค้นหาด้วย HN หรือ<Link className="text-link" href="/patients/add">เพิ่มผู้ป่วย</Link></p> : results.map((item) => <button key={item.id} className="case-patient-choice" onClick={() => setPatientId(item.id)}><span><strong>{item.fullName}</strong><small>HN {item.hn}</small></span><span>เลือกผู้ป่วย →</span></button>)}</div>}</>}
    </section>
    {patient && <form onSubmit={create} className="panel case-create-section"><h2>2. นัดและการมอบหมาย</h2><fieldset disabled={saving}><legend className="sr-only">ข้อมูลเคส</legend>
      <div className="field"><span>นัดที่ต้องติดตาม <span aria-hidden="true">*</span></span>{patient.appointments.length === 0 ? <div className="state-banner">ผู้ป่วยยังไม่มีนัด <Link href={`/patients/${patientId}`} className="text-link">ไปเพิ่มนัดในข้อมูลผู้ป่วย</Link></div> : patient.appointments.map((a) => <div key={a.id} className="case-appointment-choice">{a.followUp ? <><span><strong>{a.clinic}</strong><small>{new Date(a.appointmentAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })} · มีเคสแล้ว</small></span><Link className="text-link" href={`/follow-up/${a.followUp.id}`}>เปิดเคสเดิม →</Link></> : ["scheduled", "missed"].includes(a.status) ? <label><input type="radio" name="appointment" required checked={appointmentId === a.id} onChange={() => setAppointmentId(a.id)} /><span><strong>{a.clinic}</strong><small>{new Date(a.appointmentAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })} · {a.status === "missed" ? "ขาดนัด" : "นัดหมาย"}</small></span></label> : <span><strong>{a.clinic}</strong><small>นัดสิ้นสุดแล้ว — สร้างเคสไม่ได้</small></span>}</div>)}</div>
      <div className="case-form-columns">
        <label className="field">ความเร่งด่วน<select value={priority} onChange={(e) => setPriority(e.target.value)}>{Object.entries(CASE_PRIORITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <div className="case-assignee-field">
          <div className="assignee-current" role="group" aria-label="ผู้ดูแลประจำของผู้ป่วย">
            <span className="assignee-current-icon" aria-hidden="true">อสม.</span>
            <div><span>ผู้ดูแลประจำของผู้ป่วย</span><strong>{patient.patient.assigneeName ?? "ยังไม่มอบหมาย"}</strong></div>
            <span className={`assignee-status ${patient.patient.assigneeName ? "assigned" : "unassigned"}`}>{patient.patient.assigneeName ? "ใช้ผู้ดูแลประจำ" : "รอมอบหมาย"}</span>
          </div>
          <label className="field">เลือกผู้รับผิดชอบคนอื่น<select value={volunteerId} onChange={(e) => setVolunteerId(e.target.value)}><option value="">ใช้ผู้ดูแลประจำหรือยังไม่มอบหมาย</option>{volunteers.map((v) => <option key={v.id} value={v.id}>{v.full_name}</option>)}</select>{volunteerError && <small>โหลดรายชื่อ อสม. ไม่สำเร็จ สามารถมอบหมายภายหลังได้</small>}</label>
        </div>
      </div>
      <label className="field">รายละเอียดสำหรับผู้ติดตาม<textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="ระบุสิ่งที่ต้องติดตาม หรือข้อควรทราบ" /></label>
      <div className="state-banner">การสร้างเคสจะคงวันและสถานะนัดเดิม หากมีผู้รับผิดชอบ ระบบจะส่งงานใหม่เข้า LINE ทันที และเตือนงานค้างวันละ 1 รอบ เวลา 08:00 น.</div>
      </fieldset><div className="case-create-actions"><Link className="button secondary" href="/cases">ยกเลิก</Link><button className="button primary" disabled={!appointmentId || saving}>{saving ? "กำลังสร้างเคส…" : "สร้างเคสติดตาม"}</button></div>
    </form>}
  </div>;
}
