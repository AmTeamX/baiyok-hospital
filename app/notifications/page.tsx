"use client";

import { LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type NotificationItem = {
  id: string;
  kind: string;
  channel: string;
  status: string;
  attempt_count: number;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
  sent_at: string | null;
  created_at: string | null;
  error_message: string | null;
  recipient_name: string;
  follow_up_id: string | null;
};

const statusLabel: Record<string, string> = {
  pending: "รอส่ง",
  processing: "กำลังส่ง",
  sent: "ส่งแล้ว",
  failed: "ส่งไม่สำเร็จ",
  dead_letter: "ส่งซ้ำไม่ได้",
  unlinked: "ยังไม่ผูก LINE",
  blocked: "ถูกบล็อก"
};

const retryable = new Set(["failed", "dead_letter", "blocked"]);

function thaiTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/notifications");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "โหลดรายการแจ้งเตือนไม่สำเร็จ");
      setItems(body.notifications ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดรายการแจ้งเตือนไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function retry(id: string) {
    setRetrying(id);
    try {
      const response = await fetch("/api/notifications/retry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "ส่งซ้ำไม่สำเร็จ");
      await load();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "ส่งซ้ำไม่สำเร็จ");
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">การแจ้งเตือน</p>
          <h1>งานส่งข้อความ อสม.</h1>
          <p>ติดตามสถานะการส่ง LINE และส่งซ้ำกรณีไม่สำเร็จ</p>
        </div>
        <button className="button secondary" onClick={() => void load()} disabled={loading}>
          {loading ? <><LoaderCircle className="spin" size={17} />กำลังโหลด</> : "รีเฟรช"}
        </button>
      </div>

      {error && <div className="demo-banner"><TriangleAlert size={18} /><span><strong>เกิดข้อผิดพลาด</strong> {error}</span></div>}

      <section className="panel table-panel">
        <div className="patient-table">
          <div className="table-row table-header"><span>ผู้รับ</span><span>ชนิด</span><span>สถานะ</span><span>ลองแล้ว</span><span>เวลาส่งล่าสุด</span><span /></div>
          {loading ? (
            <div className="empty-state"><strong>กำลังโหลด</strong><p>รอสักครู่…</p></div>
          ) : items.length === 0 ? (
            <div className="empty-state"><strong>ยังไม่มีงานแจ้งเตือน</strong><p>เมื่อมอบหมายงานให้ อสม. รายการจะแสดงที่นี่</p></div>
          ) : (
            items.map((item) => (
              <div className="table-row" key={item.id}>
                <span data-label="ผู้รับ"><strong>{item.recipient_name}</strong><small>{item.kind === "follow_up_assigned" ? "งานติดตามใหม่" : item.kind}</small></span>
                <span data-label="ชนิด">{item.channel === "line" ? "LINE" : item.channel}</span>
                <span data-label="สถานะ"><i className={`status-dot status-${item.status}`}>{statusLabel[item.status] ?? item.status}</i>{item.error_message ? <small>{item.error_message}</small> : null}</span>
                <span data-label="ลองแล้ว">{item.attempt_count} ครั้ง</span>
                <span data-label="เวลาส่งล่าสุด">{thaiTime(item.last_attempt_at ?? item.sent_at)}</span>
                {retryable.has(item.status) ? <button className="button secondary" onClick={() => void retry(item.id)} disabled={retrying === item.id}>{retrying === item.id ? <LoaderCircle className="spin" size={17} /> : <RotateCcw size={16} />}ส่งซ้ำ</button> : <span />}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
