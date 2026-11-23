"use client";

import { CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function CheckInCard() {
  const params = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const appointmentId = params.get("appointment") ?? "";
  const token = params.get("token") ?? "";
  async function confirm() {
    setState("loading");
    try {
      const response = await fetch("/api/check-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appointmentId, token }) });
      setState(response.ok ? "done" : "error");
    } catch { setState("error"); }
  }
  return <section className="public-card checkin-card"><p className="eyebrow">รพ.สต. สระโคล่ · เช็กอินตามนัด</p>{state === "done" ? <><CheckCircle2 className="big-success" /><h1>เช็กอินเรียบร้อย</h1><p>แจ้งเจ้าหน้าที่ว่ามาถึงแล้ว เพื่อยืนยันการเข้ารับบริการ</p></> : <><h1>{!appointmentId || !token ? "ลิงก์เช็กอินไม่ครบถ้วน" : "มาถึงหน่วยบริการแล้ว?"}</h1><p role={state === "error" ? "alert" : undefined}>{!appointmentId || !token ? "กรุณาสแกน QR ที่เจ้าหน้าที่สร้างให้สำหรับนัดของคุณ" : state === "error" ? "เช็กอินไม่สำเร็จ กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่เพื่อตรวจสอบนัด" : "ยืนยันเมื่อคุณมาถึง รพ.สต. สระโคล่แล้วเท่านั้น"}</p>{appointmentId && token && <button className="button primary wide" onClick={() => void confirm()} disabled={state === "loading"}>{state === "loading" ? "กำลังเช็กอิน…" : "ยืนยันว่ามาถึงแล้ว"}</button>}</>}</section>;
}
export default function CheckInPage() { return <div className="public-page"><Suspense fallback={<p>กำลังโหลด…</p>}><CheckInCard /></Suspense></div>; }
