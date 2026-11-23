"use client";

import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Slot = {
  id: string;
  clinic: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
  active: boolean;
  checkedIn: number;
  noShow: number;
  bookings: Array<{ id: string; queueNumber: number; status: string; statusLabel: string; patientName: string | null }>;
};

function thaiTime(iso: string) {
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(iso));
}

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

export function QueueBoard() {
  const [date, setDate] = useState(todayIso());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // create form
  const [clinic, setClinic] = useState("คลินิกความดัน");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [capacity, setCapacity] = useState("20");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/queue?date=${encodeURIComponent(date)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "โหลดคิวไม่สำเร็จ");
      setSlots(body.slots ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดคิวไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createSlot() {
    setError(null);
    const startsAt = `${date}T${startTime}:00+07:00`;
    const endsAt = `${date}T${endTime}:00+07:00`;
    try {
      const response = await fetch("/api/admin/queue-slots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clinic, serviceDate: date, startsAt, endsAt, capacity: Number(capacity) })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "สร้าง slot ไม่สำเร็จ");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "สร้าง slot ไม่สำเร็จ");
    }
  }

  async function override(bookingId: string, status: "checked_in" | "no_show", reason: string) {
    setBusy(bookingId);
    try {
      const response = await fetch(`/api/queue/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, reason })
      });
      if (!response.ok) throw new Error("อัปเดตคิวไม่สำเร็จ");
      await load();
    } catch (overrideError) {
      setError(overrideError instanceof Error ? overrideError.message : "อัปเดตคิวไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="qr-layout">
      <section className="panel qr-form">
        <h2>จัดการ slot</h2>
        <label className="field"><span>วันที่</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label className="field"><span>คลินิก</span><input value={clinic} onChange={(event) => setClinic(event.target.value)} /></label>
        <div className="two-fields">
          <label className="field"><span>เริ่ม</span><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
          <label className="field"><span>สิ้นสุด</span><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
        </div>
        <label className="field"><span>จำนวนที่รับ</span><input type="number" min={1} value={capacity} onChange={(event) => setCapacity(event.target.value)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary wide" onClick={() => void createSlot()}>สร้าง slot</button>
      </section>

      <section className="panel qr-preview" style={{ alignContent: "start" }}>
        <h2>คิวรายวัน · {new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date(`${date}T12:00:00`))}</h2>
        {loading ? (
          <p className="volunteer-hint">กำลังโหลด…</p>
        ) : slots.length === 0 ? (
          <div className="empty-state"><strong>ยังไม่มี slot</strong><p>สร้าง slot เพื่อเปิดให้ผู้ป่วยจองคิว</p></div>
        ) : (
          slots.map((slot) => (
            <div key={slot.id} className="queue-slot-card">
              <div className="queue-slot-head">
                <strong>{slot.clinic} · {thaiTime(slot.startsAt)}–{thaiTime(slot.endsAt)}</strong>
                <span>{slot.bookedCount}/{slot.capacity} · มา {slot.checkedIn} · ไม่มา {slot.noShow}</span>
              </div>
              {slot.bookings.length === 0 ? (
                <small className="muted-count">ยังไม่มีผู้จอง</small>
              ) : (
                <ul className="queue-booking-list">
                  {slot.bookings.map((booking) => (
                    <li key={booking.id}>
                      <span>คิวที่ {booking.queueNumber} · {booking.patientName ?? "—"} <i className={`status-dot status-q-${booking.status}`}>{booking.statusLabel}</i></span>
                      {booking.status === "booked" && (
                        <span className="queue-booking-actions">
                          <button className="button secondary" disabled={busy === booking.id} onClick={() => void override(booking.id, "checked_in", "ยืนยันมาแล้ว")}>{busy === booking.id ? <LoaderCircle className="spin" size={14} /> : null}มาแล้ว</button>
                          <button className="button secondary" disabled={busy === booking.id} onClick={() => void override(booking.id, "no_show", "ไม่มาตามนัด")}>{busy === booking.id ? <LoaderCircle className="spin" size={14} /> : null}ไม่มา</button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
