"use client";

import { LoaderCircle, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PATIENT_REQUEST_STATUSES, PATIENT_REQUEST_STATUS_LABELS, type PatientRequestStatus } from "@/lib/patient";
import { Modal } from "@/components/modal";

type RequestItem = {
  id: string;
  typeLabel: string;
  reasonLabel: string;
  note: string | null;
  status: string;
  statusLabel: string;
  patientName: string | null;
  assigneeName: string | null;
  createdAt: string | null;
  appointmentId: string | null;
  appointmentAt: string | null;
  appointmentClinic: string | null;
  patientId: string | null;
  staffResponse: string | null;
};

function thaiTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

export default function RequestsPage() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<RequestItem | null>(null);
  const [appointmentAt, setAppointmentAt] = useState("");
  const [appointmentClinic, setAppointmentClinic] = useState("");
  const [staffResponse, setStaffResponse] = useState("");

  function openRequest(item: RequestItem) {
    setSelected(item);
    setAppointmentAt(toDateTimeLocal(item.appointmentAt));
    setAppointmentClinic(item.appointmentClinic ?? "");
    setStaffResponse(item.staffResponse ?? "");
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : "";
      const response = await fetch(`/api/requests${query}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "โหลดคำขอไม่สำเร็จ");
      setItems(body.requests ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดคำขอไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(id: string, next: PatientRequestStatus) {
    setBusy(id);
    try {
      const response = await fetch(`/api/requests/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next, staffResponse: staffResponse.trim() })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "อัปเดตไม่สำเร็จ");
      await load();
      setSelected(null);
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : "อัปเดตไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  async function updateAppointment(action: "reschedule" | "cancel") {
    if (!selected?.appointmentId) return;
    setBusy(selected.id);
    setError(null);
    try {
      let appointmentAtIso: string | null = null;
      if (action === "reschedule") {
        if (!appointmentAt || !appointmentClinic.trim()) throw new Error("กรุณากรอกวัน เวลา และคลินิกใหม่");
        const date = new Date(`${appointmentAt}:00+07:00`);
        if (Number.isNaN(date.getTime())) throw new Error("กรุณากรอกวันและเวลานัดให้ถูกต้อง");
        appointmentAtIso = date.toISOString();
      }
      const response = await fetch(`/api/appointments/${selected.appointmentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: action === "cancel"
          ? JSON.stringify({ status: "cancelled" })
          : JSON.stringify({ appointmentAt: appointmentAtIso, clinic: appointmentClinic.trim(), status: "scheduled" })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "แก้ไขนัดไม่สำเร็จ");

      await transition(selected.id, "resolved");
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "แก้ไขนัดไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">กล่องคำขอจากผู้ป่วย</p>
          <h1>คำขอและข้อความจากผู้ป่วย</h1>
          <p>คำขอจากผู้ป่วยผ่าน LIFF จะไม่เปลี่ยนวันนัดอัตโนมัติ ต้องให้เจ้าหน้าที่ประสานต่อ</p>
        </div>
        <select className="request-filter" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="กรองตามสถานะ">
          <option value="">ทุกสถานะ</option>
          {PATIENT_REQUEST_STATUSES.map((option) => (
            <option key={option} value={option}>{PATIENT_REQUEST_STATUS_LABELS[option]}</option>
          ))}
        </select>
      </div>

      {error && <div className="demo-banner"><TriangleAlert size={18} /><span><strong>เกิดข้อผิดพลาด</strong> {error}</span></div>}

      <section className="panel table-panel requests-panel">
        <div className="panel-head"><div><h2>รายการคำขอ</h2><p>{loading ? "กำลังโหลด…" : `${items.length} รายการ${status ? ` · ${PATIENT_REQUEST_STATUS_LABELS[status as PatientRequestStatus]}` : ""}`}</p></div><button className="button secondary" onClick={() => void load()} disabled={loading}>รีเฟรช</button></div>
        <div className="patient-table">
          <div className="table-row table-header"><span>ผู้ป่วย</span><span>เหตุผล</span><span>สถานะ</span><span>เวลา</span><span /></div>
          {loading ? (
            <div className="empty-state"><strong>กำลังโหลด</strong><p>รอสักครู่…</p></div>
          ) : items.length === 0 ? (
            <div className="empty-state"><strong>ยังไม่มีคำขอ</strong><p>เมื่อผู้ป่วยส่งคำขอผ่าน LINE รายการจะแสดงที่นี่</p></div>
          ) : (
            items.map((item) => (
              <div className="table-row" key={item.id}>
                <span data-label="ผู้ป่วย">
                  <strong>{item.patientName ?? "—"}</strong>
                  <small>{item.typeLabel}</small>
                </span>
                <span data-label="เหตุผล"><strong>{item.reasonLabel}</strong>{item.note ? <small className="truncate-note">{item.note}</small> : null}</span>
                <span data-label="สถานะ"><i className={`status-dot status-req-${item.status}`}>{item.statusLabel}</i>{item.assigneeName ? <small>ผู้รับ: {item.assigneeName}</small> : null}</span>
                <span data-label="เวลา">{thaiTime(item.createdAt)}</span>
                <span data-label="">
                  <button className="button secondary" onClick={() => openRequest(item)}>เปิดและจัดการ</button>
                </span>
              </div>
            ))
          )}
        </div>
      </section>
      <Modal open={Boolean(selected)} onClose={() => { if (!busy) setSelected(null); }} title={selected?.typeLabel ?? "รายละเอียดคำขอ"} description={selected?.patientName ?? "ไม่ระบุผู้ป่วย"}>
        {selected && (
          <div className="request-detail">
            <i className={`status-dot status-req-${selected.status}`}>{selected.statusLabel}</i>
            <dl className="detail-facts">
              <div><dt>เหตุผล</dt><dd>{selected.reasonLabel}</dd></div>
              <div><dt>ส่งเมื่อ</dt><dd>{thaiTime(selected.createdAt)}</dd></div>
              <div><dt>ผู้รับผิดชอบ</dt><dd>{selected.assigneeName ?? "ยังไม่รับเรื่อง"}</dd></div>
              {selected.appointmentId && (
                <div>
                  <dt>นัดที่เกี่ยวข้อง</dt>
                  <dd>
                    <strong>{selected.appointmentClinic ?? "คลินิก"}</strong>
                    {selected.appointmentAt && <small>{thaiTime(selected.appointmentAt)}</small>}
                    {selected.patientId && (
                      <Link className="text-link" href={`/patients/${selected.patientId}`}>เปิดข้อมูลผู้ป่วยและนัด ›</Link>
                    )}
                  </dd>
                </div>
              )}
            </dl>
            <div className="request-note"><strong>ข้อความจากผู้ป่วย</strong><p>{selected.note || "ไม่มีรายละเอียดเพิ่มเติม"}</p></div>
            {selected.appointmentId && (
              <form className="case-form" onSubmit={(event) => { event.preventDefault(); void updateAppointment("reschedule"); }}>
                <div className="panel-head"><div><h3>จัดการนัดนี้</h3><p>เปลี่ยนวันหรือยกเลิกนัดได้ทันทีจากคำขอนี้</p></div></div>
                <label className="field"><span>วันและเวลานัดใหม่</span><input type="datetime-local" value={appointmentAt} onChange={(event) => setAppointmentAt(event.target.value)} required /></label>
                <label className="field"><span>คลินิก</span><input value={appointmentClinic} onChange={(event) => setAppointmentClinic(event.target.value)} required /></label>
                <div className="modal-actions">
                  <button type="button" className="button danger" disabled={Boolean(busy)} onClick={() => void updateAppointment("cancel")}>ยกเลิกนัด</button>
                  <button type="submit" className="button primary" disabled={Boolean(busy)}>บันทึกและเลื่อนนัด</button>
                </div>
              </form>
            )}
            <label className="field">
              <span>ข้อความตอบผู้ป่วย</span>
              <textarea value={staffResponse} onChange={(event) => setStaffResponse(event.target.value)} placeholder="เช่น ติดต่อแล้ว ได้เลื่อนนัดเป็น..." maxLength={500} />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions">
              <button className="button secondary" disabled={Boolean(busy)} onClick={() => setSelected(null)}>ปิด</button>
              {selected.status === "new" ? (
                <button className="button primary" disabled={Boolean(busy)} onClick={() => void transition(selected.id, "acknowledged")}>{busy ? <LoaderCircle className="spin" size={16} /> : null}รับเรื่อง</button>
              ) : (
                <>
                  {selected.status !== "resolved" && (
                    <button className="button secondary" disabled={Boolean(busy)} onClick={() => void transition(selected.id, "contacted")}>{busy ? <LoaderCircle className="spin" size={16} /> : null}ส่งข้อความตอบกลับ</button>
                  )}
                  {(selected.status === "acknowledged" || selected.status === "contacted") && (
                <button className="button primary" disabled={Boolean(busy)} onClick={() => void transition(selected.id, "resolved")}>{busy ? <LoaderCircle className="spin" size={16} /> : null}ปิดเรื่อง</button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
