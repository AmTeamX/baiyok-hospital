"use client";

import { CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function CheckInCard() { const params = useSearchParams(); const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle"); const appointmentId = params.get("appointment") ?? ""; const token = params.get("token") ?? ""; async function confirm() { setState("loading"); const response = await fetch("/api/check-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appointmentId, token }) }); setState(response.ok ? "done" : "error"); } return <section className="public-card checkin-card">{state === "done" ? <><CheckCircle2 className="big-success" /><h1>เช็กอินเรียบร้อย</h1><p>กรุณารอเรียกคิว เจ้าหน้าที่จะตรวจสอบการมารับบริการอีกครั้ง</p></> : <><p className="eyebrow">เช็กอินเข้ารับบริการ</p><h1>มาถึงแล้วใช่ไหม?</h1><p>{state === "error" ? "ลิงก์ไม่ถูกต้องหรือหมดอายุ กรุณาติดต่อเจ้าหน้าที่" : "กดยืนยันเมื่อคุณมาถึงหน่วยบริการแล้ว"}</p><button className={`button primary wide ${state}`} onClick={confirm} disabled={!appointmentId || !token || state === "loading"}>{state === "loading" ? "กำลังเช็กอิน…" : "ยืนยันเช็กอิน"}</button></>}</section>; }
export default function CheckInPage() { return <div className="public-page"><Suspense fallback={<p>กำลังโหลด…</p>}><CheckInCard /></Suspense></div>; }
