"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleAlert, Clock3, LoaderCircle, RotateCcw, Save, UserRoundCheck } from "lucide-react";
import { type FollowUpDetail } from "@/lib/follow-up";
import { MISSED_PRIORITIES, MISSED_STATUSES, type MissedPriority, type MissedStatus } from "@/lib/missed";
import { LineLinkInvite } from "@/components/line-link-invite";

type DetailResponse = { ok: boolean; followUp?: FollowUpDetail; error?: string; mode?: "demo" | "database" };

const STATUS_LABEL: Record<MissedStatus, string> = {
  pending: "รอติดตาม",
  assigned: "กำลังติดตาม",
  contacted: "กำลังติดตาม (ติดต่อแล้ว)",
  rescheduled: "นัดใหม่แล้ว",
  returned: "กลับมารับบริการ",
  closed: "ปิดเคส"
};
const PRIORITY_LABEL: Record<MissedPriority, string> = { normal: "ปกติ", high: "สูง", urgent: "ด่วน" };

function thaiDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(date);
}
function daysLate(appointmentAt: string) {
  if (!appointmentAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(appointmentAt).getTime()) / 86400000));
}

export function CaseDetail({ id }: { id: string }) {
  const [detail, setDetail] = useState<FollowUpDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<MissedStatus>("pending");
  const [priority, setPriority] = useState<MissedPriority>("normal");
  const [missedReason, setMissedReason] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [counsellingNote, setCounsellingNote] = useState("");
  const [closureReason, setClosureReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [activityType, setActivityType] = useState("");
  const [activityNote, setActivityNote] = useState("");
  const [adding, setAdding] = useState(false);

  const [volunteers, setVolunteers] = useState<Array<{ id: string; full_name: string; active: boolean }>>([]);
  const [selectedVolunteer, setSelectedVolunteer] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/volunteers").then((response) => response.json()).then((body) => {
      setVolunteers((body.volunteers ?? []).filter((volunteer: { active: boolean }) => volunteer.active));
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setConflict(false);
    try {
      const response = await fetch(`/api/follow-ups/${id}`);
      const json = (await response.json()) as DetailResponse;
      if (!response.ok || !json.followUp) {
        setError(json.error === "not_found" ? "ไม่พบเคสนี้" : json.error ?? "โหลดข้อมูลไม่สำเร็จ");
        setDetail(null);
      } else {
        setDetail(json.followUp);
        setStatus(json.followUp.status);
        setPriority(json.followUp.priority);
        setMissedReason(json.followUp.missedReason ?? "");
        setReasonNote(json.followUp.reasonNote ?? "");
        setCounsellingNote(json.followUp.counsellingNote ?? "");
        setClosureReason(json.followUp.closureReason ?? "");
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    setSaving(true);
    setSaved(false);
    setConflict(false);
    setSaveError(null);
    try {
      const response = await fetch(`/api/follow-ups/${detail.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: detail.version, status, priority, missedReason: missedReason || null, reasonNote: reasonNote || null, counsellingNote: counsellingNote || null, closureReason: closureReason || null })
      });
      const json = (await response.json()) as { ok: boolean; version?: number; error?: string };
      if (response.status === 409) {
        setConflict(true);
        await load();
      } else if (!response.ok) {
        setSaveError(json.error ?? "บันทึกไม่สำเร็จ");
      } else {
        setSaved(true);
        await load();
      }
    } catch {
      setSaveError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setSaving(false);
    }
  }

  async function addActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !activityType.trim()) return;
    setAdding(true);
    try {
      const response = await fetch(`/api/follow-ups/${detail.id}/activities`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ activityType: activityType.trim(), note: activityNote.trim() || null })
      });
      if (response.ok) {
        setActivityType("");
        setActivityNote("");
        await load();
      }
    } finally {
      setAdding(false);
    }
  }

  async function assign() {
    if (!detail || !selectedVolunteer) return;
    setAssigning(true);
    setAssignMessage(null);
    try {
      const response = await fetch(`/api/follow-ups/${detail.id}/assign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ volunteer_id: selectedVolunteer })
      });
      const body = await response.json();
      if (!response.ok) {
        setAssignMessage(body.error ?? "มอบหมายไม่สำเร็จ");
      } else {
        setAssignMessage(body.notification_status === "unlinked" ? "มอบหมายแล้ว (อสม. ยังไม่ผูก LINE)" : "มอบหมายแล้วและส่งการแจ้งเตือนแล้ว");
        await load();
      }
    } catch {
      setAssignMessage("มอบหมายไม่สำเร็จ");
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return <div className="page-shell"><div className="state-banner" role="status"><LoaderCircle className="spin" size={18} /><span>กำลังโหลดเคส…</span></div></div>;
  }
  if (error || !detail) {
    return <div className="page-shell"><div className="state-banner error" role="alert"><CircleAlert size={18} /><span>{error ?? "ไม่พบเคสนี้"}</span><button className="button secondary" onClick={() => void load()}><RotateCcw size={16} />ลองใหม่</button></div></div>;
  }

  const late = daysLate(detail.appointment.appointmentAt);

  return (
    <div className="page-shell">
      <div className="page-heading compact">
        <div>
          <p className="eyebrow">รายละเอียดเคสติดตาม</p>
          <h1>{detail.patient.fullName}</h1>
          <p>HN {detail.patient.hn} · อายุ {detail.patient.age} ปี · {detail.patient.village ?? "ไม่ระบุหมู่บ้าน"}</p>
        </div>
        <span className="late-badge large">เลยนัด {late} วัน</span>
      </div>

      {conflict && (
        <div className="state-banner warning" role="alert">
          <CircleAlert size={18} />
          <span>มีผู้แก้ไขเคสนี้ก่อนหน้านี้ ระบบได้โหลดข้อมูลล่าสุดให้แล้ว กรุณาตรวจสอบและบันทึกอีกครั้ง</span>
        </div>
      )}
      {saved && <div className="state-banner success" role="status"><UserRoundCheck size={18} /><span>บันทึกการติดตามแล้ว</span></div>}
      {saveError && <div className="state-banner error" role="alert"><CircleAlert size={18} /><span>{saveError}</span></div>}

      <div className="case-grid">
        <section className="panel case-summary">
          <h2>ข้อมูลนัดและสาเหตุ</h2>
          <dl>
            <div><dt>วันนัดเดิม</dt><dd>{thaiDateTime(detail.appointment.appointmentAt)}</dd></div>
            <div><dt>คลินิก</dt><dd>{detail.appointment.clinic}</dd></div>
            <div><dt>สาเหตุที่ขาดนัด</dt><dd>{detail.missedReason ?? "รอประเมิน"}</dd></div>
            <div><dt>ผู้รับผิดชอบ</dt><dd>{detail.assigneeName ?? "ยังไม่มอบหมาย"}</dd></div>
            <div><dt>ความเร่งด่วน</dt><dd>{PRIORITY_LABEL[detail.priority]}</dd></div>
            <div><dt>หลักฐานปิดเคส</dt><dd>{detail.closureReason ?? (detail.returnedConfirmedAt ? `กลับมารับบริการเมื่อ ${thaiDateTime(detail.returnedConfirmedAt)}` : "ยังไม่มี")}</dd></div>
          </dl>
        </section>

        <section className="panel case-edit">
          <h2>บันทึก/แก้ไขผลติดตาม</h2>
          <form onSubmit={save} className="case-form">
            <label className="field"><span>สถานะ</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as MissedStatus)}>
                {MISSED_STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}
              </select>
            </label>
            <label className="field"><span>ความเร่งด่วน</span>
              <select value={priority} onChange={(event) => setPriority(event.target.value as MissedPriority)}>
                {MISSED_PRIORITIES.map((value) => <option key={value} value={value}>{PRIORITY_LABEL[value]}</option>)}
              </select>
            </label>
            <label className="field"><span>สาเหตุที่ขาดนัด</span><input value={missedReason} onChange={(event) => setMissedReason(event.target.value)} /></label>
            <label className="field"><span>รายละเอียดเพิ่มเติม</span><textarea value={reasonNote} onChange={(event) => setReasonNote(event.target.value)} /></label>
            <label className="field"><span>บันทึกคำปรึกษา</span><textarea value={counsellingNote} onChange={(event) => setCounsellingNote(event.target.value)} /></label>
            <label className="field"><span>เหตุผลการปิดเคส</span><input value={closureReason} onChange={(event) => setClosureReason(event.target.value)} placeholder="ระบุเมื่อปิดเคส" /></label>
            <button className={`button primary ${saving ? "loading" : ""}`} disabled={saving}>{saving ? <><LoaderCircle className="spin" size={18} />กำลังบันทึก</> : <><Save size={18} />บันทึกการติดตาม</>}</button>
          </form>
        </section>
      </div>

      <section className="panel case-summary" style={{ marginBlockStart: "var(--space-lg)" }}>
        <h2>มอบหมาย อสม.</h2>
        <p>ผู้รับผิดชอบปัจจุบัน: {detail.assigneeName ?? "ยังไม่มอบหมาย"}</p>
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

      <section className="panel case-summary" style={{ marginBlockStart: "var(--space-lg)" }}>
        <h2>เชื่อมบัญชี LINE</h2>
        <p>สร้าง QR ให้ผู้ป่วยสแกนในแอป LINE เพื่อผูกบัญชี — ใช้ได้ครั้งเดียว หมดอายุ 15 นาที</p>
        <LineLinkInvite targetType="patient" targetId={detail.patient.id} role="patient" label="สร้างรหัสเชื่อม LINE" />
      </section>

      <section className="panel timeline-panel">
        <div className="panel-head">
          <div><h2>เส้นเวลากิจกรรม</h2><p>บันทึกแบบต่อท้าย ไม่สามารถแก้ไขหรือลบรายการเดิมได้</p></div>
        </div>
        {detail.activities.length === 0 ? (
          <div className="state-banner empty"><Clock3 size={18} /><span>ยังไม่มีกิจกรรมที่บันทึก</span></div>
        ) : (
          <ol className="timeline">
            {detail.activities.map((activity) => (
              <li key={activity.id}>
                <span className="timeline-dot" />
                <div><strong>{activity.activityType}</strong><small>{activity.performerName ?? "ระบบ"} · {thaiDateTime(activity.performedAt)}</small>{activity.note && <p>{activity.note}</p>}</div>
              </li>
            ))}
          </ol>
        )}
        <form onSubmit={addActivity} className="activity-form">
          <label className="field"><span>กิจกรรมใหม่</span><input value={activityType} onChange={(event) => setActivityType(event.target.value)} placeholder="เช่น โทรศัพท์ติดตาม, ให้คำปรึกษาเรื่องยา" required /></label>
          <label className="field"><span>บันทึกเพิ่มเติม</span><input value={activityNote} onChange={(event) => setActivityNote(event.target.value)} placeholder="รายละเอียด (ไม่บังคับ)" /></label>
          <button className={`button secondary ${adding ? "loading" : ""}`} disabled={adding}>{adding ? <LoaderCircle className="spin" size={18} /> : "เพิ่มกิจกรรม"}</button>
        </form>
      </section>
    </div>
  );
}
