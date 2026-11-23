"use client";

import { HeartPulse, QrCode } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Slot = {
  id: string;
  clinic: string;
  serviceDate: string;
  startsAt: string;
  endsAt: string;
  remaining: number;
};

type Booking = {
  id: string;
  queueNumber: number;
  statusLabel: string;
  clinic: string;
  serviceDate: string;
  startsAt: string;
};

function thaiDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(`${value}T00:00:00`));
}

function timeOf(iso: string) {
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(iso));
}

export default function LiffQueuePage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selected, setSelected] = useState("");
  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "done">("loading");
  const [result, setResult] = useState<{ queueNumber: number; checkInUrl: string } | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [slotsResponse, bookingsResponse] = await Promise.all([
        fetch("/api/patient/me/queue-slots"),
        fetch("/api/patient/me/bookings")
      ]);
      if (slotsResponse.status === 401 || slotsResponse.status === 403) {
        window.location.href = "/liff/context";
        return;
      }
      const slotsBody = await slotsResponse.json();
      const bookingsBody = await bookingsResponse.json();
      if (!slotsResponse.ok) throw new Error(slotsBody.error ?? "unauthorized");
      setSlots(slotsBody.slots ?? []);
      setBookings(bookingsBody.ok ? bookingsBody.bookings ?? [] : []);
      setPhase("ready");
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "โหลดคิวไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function book() {
    if (!selected) return;
    try {
      const response = await fetch("/api/patient/me/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotId: selected })
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error === "conflict" ? "ช่วงเวลานี้เต็มแล้ว หรือคุณมีคิวในวันนี้แล้ว" : "จองคิวไม่สำเร็จ");
        setPhase("error");
        return;
      }
      setResult({ queueNumber: body.queueNumber, checkInUrl: body.checkInUrl });
      setPhase("done");
    } catch {
      setMessage("จองคิวไม่สำเร็จ");
      setPhase("error");
    }
  }

  return (
    <div className="patient-page">
      <header className="patient-brand"><span><HeartPulse /> รพ.สต. สระโคล่</span><small>จองคิว</small></header>
      <main className="patient-content volunteer-detail">
        {phase === "loading" && <p className="volunteer-hint">กำลังโหลด…</p>}

        {phase === "done" && result && (
          <section className="appointment-hero">
            <h2>จองคิวสำเร็จ</h2>
            <p>คิวที่ {result.queueNumber} · ใช้ลิงก์ด้านล่างเพื่อเช็กอินเมื่อมาถึง</p>
            <a className="button patient-primary" href={result.checkInUrl}><QrCode /> เปิด QR เช็กอิน</a>
            <a className="button patient-primary" href="/liff/appointments">กลับไปวันนัดของฉัน</a>
          </section>
        )}

        {phase === "error" && (
          <section className="appointment-hero">
            <h2>จองคิวไม่สำเร็จ</h2>
            <p>{message}</p>
            <button className="button patient-primary" onClick={() => { setPhase("ready"); void load(); }}>ลองใหม่</button>
          </section>
        )}

        {phase === "ready" && (
          <>
            {bookings.length > 0 && (
              <section>
                <h2>คิวของคุณ</h2>
                <ul className="volunteer-task-list">
                  {bookings.map((booking) => (
                    <li key={booking.id} className="volunteer-task">
                      <div className="volunteer-task-main">
                        <strong>{booking.clinic} · คิวที่ {booking.queueNumber}</strong>
                        <small>{thaiDate(booking.serviceDate)} · {timeOf(booking.startsAt)} น. · {booking.statusLabel}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2>เลือกช่วงเวลาที่เปิดจอง</h2>
              {slots.length === 0 ? (
                <p className="volunteer-hint">ยังไม่มีช่วงเวลาที่เปิดจอง</p>
              ) : (
                <fieldset className="volunteer-result-grid">
                  <legend>ช่วงเวลา</legend>
                  {slots.map((slot) => (
                    <label key={slot.id}>
                      <input type="radio" name="slot" value={slot.id} checked={selected === slot.id} onChange={() => setSelected(slot.id)} />
                      <span>{slot.clinic} · {thaiDate(slot.serviceDate)} · {timeOf(slot.startsAt)}–{timeOf(slot.endsAt)} น. (ว่าง {slot.remaining})</span>
                    </label>
                  ))}
                </fieldset>
              )}
            </section>

            <div className="volunteer-save-bar">
              <p>การจองคิวจะสร้างนัดใหม่ให้โดยอัตโนมัติ</p>
              <button className="button primary" disabled={!selected} onClick={() => void book()}>ยืนยันการจอง</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
