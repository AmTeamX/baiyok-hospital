"use client";

import { HeartPulse } from "lucide-react";
import { useEffect, useState } from "react";

type Phase = "loading" | "consent" | "busy" | "error" | "success";

export default function LiffLinkPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const role = params.get("role");
    if (!code || (role !== "patient" && role !== "volunteer")) {
      setPhase("error");
      setMessage("ลิงก์ผูกบัญชีไม่ถูกต้อง กรุณาสแกน QR ที่เจ้าหน้าที่สร้างให้ใหม่อีกครั้ง");
      return;
    }
    setPhase("consent");
  }, []);

  async function confirm() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const role = params.get("role");
    setPhase("busy");

    try {
      const init = await fetch("/api/line/liff/init").then((response) => response.json());
      if (!init.ok) throw new Error("ไม่สามารถเริ่มการยืนยันตัวตนได้");

      const liff = (window as unknown as { liff?: { init?: (options: { liffId: string }) => Promise<void>; getIDToken?: () => string | null } }).liff;
      if (!liff?.init || typeof liff.getIDToken !== "function") throw new Error("ไม่พบ LIFF SDK");
      await liff.init({ liffId: init.liffId });
      const idToken = liff.getIDToken();
      if (!idToken) throw new Error("กรุณาเปิดหน้านี้จากแอป LINE");

      const response = await fetch("/api/line/link/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken, code, nonce: init.nonce, role })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "ผูกบัญชีไม่สำเร็จ");

      setPhase("success");
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
  }

  return (
    <div className="patient-page">
      <header className="patient-brand"><span><HeartPulse /> รพ.สต. สระโคล่</span><small>ผูกบัญชี LINE</small></header>
      <main className="patient-content">
        {phase === "loading" && <p>กำลังโหลด…</p>}
        {phase === "error" && (
          <section className="appointment-hero">
            <h2>ไม่สามารถผูกบัญชีได้</h2>
            <p>{message}</p>
          </section>
        )}
        {phase === "consent" && (
          <section className="appointment-hero">
            <h2>ยินยอมให้เชื่อมบัญชี LINE</h2>
            <p>ระบบจะใช้ LINE เพื่อแจ้งเตือนนัดและสื่อสุขภาพ โดยไม่ส่งข้อมูลสุขภาพละเอียดผ่านข้อความ</p>
            <button className="button patient-primary" onClick={confirm}>ยินยอมและผูกบัญชี</button>
          </section>
        )}
        {phase === "busy" && <p>กำลังยืนยันตัวตน…</p>}
        {phase === "success" && (
          <section className="appointment-hero">
            <h2>ผูกบัญชีสำเร็จ</h2>
            <p>คุณสามารถกลับไปที่แอป LINE เพื่อใช้งานเมนูได้เลย</p>
            <a className="button patient-primary" href="/liff/context">เลือกโหมดการใช้งาน</a>
          </section>
        )}
      </main>
    </div>
  );
}
