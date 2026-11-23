"use client";

import QRCode from "qrcode";
import { CalendarCheck, LoaderCircle, QrCode } from "lucide-react";
import { useState } from "react";

export function QueueQr() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const [hn, setHn] = useState(""); const [date, setDate] = useState(today); const [image, setImage] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function generate() {
    setLoading(true); setError(""); setImage("");
    try {
      const response = await fetch("/api/queue-token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hn, date }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "สร้าง QR ไม่สำเร็จ");
      setImage(await QRCode.toDataURL(result.url, { width: 420, margin: 2 }));
    } catch (error) { setError(error instanceof Error ? error.message : "เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setLoading(false); }
  }
  return <div className="qr-layout"><section className="panel qr-form"><h2>ข้อมูลนัด</h2><label className="field"><span>HN</span><input value={hn} onChange={e => setHn(e.target.value)} /></label><label className="field"><span>วันที่นัด</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary wide" onClick={generate} disabled={!hn || !date || loading}>{loading ? <><LoaderCircle className="spin" size={18} />กำลังสร้าง</> : <><QrCode size={18} />สร้าง QR เช็กอิน</>}</button></section><section className="panel qr-preview">{image ? <><img src={image} alt={`QR เช็กอิน HN ${hn}`} width={260} height={260} /><h2>พร้อมเช็กอิน</h2><p>HN {hn} · {new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date(`${date}T12:00:00`))}</p></> : <><span className="qr-placeholder"><CalendarCheck size={52} /></span><h2>QR จะแสดงที่นี่</h2><p>ตรวจสอบ HN และวันนัดก่อนสร้างทุกครั้ง</p></>}</section></div>;
}
