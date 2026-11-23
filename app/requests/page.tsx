"use client";

import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PATIENT_REQUEST_STATUSES, PATIENT_REQUEST_STATUS_LABELS, type PatientRequestStatus } from "@/lib/patient";

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
};

function thaiTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

export default function RequestsPage() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
        body: JSON.stringify({ status: next })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "อัปเดตไม่สำเร็จ");
      await load();
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : "อัปเดตไม่สำเร็จ");
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

      <section className="panel table-panel">
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
                <span data-label="เหตุผล"><strong>{item.reasonLabel}</strong>{item.note ? <small>{item.note}</small> : null}</span>
                <span data-label="สถานะ"><i className={`status-dot status-req-${item.status}`}>{item.statusLabel}</i>{item.assigneeName ? <small>ผู้รับ: {item.assigneeName}</small> : null}</span>
                <span data-label="เวลา">{thaiTime(item.createdAt)}</span>
                <span data-label="">
                  {item.status === "new" ? (
                    <button className="button secondary" disabled={busy === item.id} onClick={() => void transition(item.id, "acknowledged")}>{busy === item.id ? <LoaderCircle className="spin" size={16} /> : null}รับเรื่อง</button>
                  ) : item.status === "acknowledged" || item.status === "contacted" ? (
                    <button className="button primary" disabled={busy === item.id} onClick={() => void transition(item.id, "resolved")}>{busy === item.id ? <LoaderCircle className="spin" size={16} /> : null}ปิดเรื่อง</button>
                  ) : null}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
