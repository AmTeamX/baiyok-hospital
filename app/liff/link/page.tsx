"use client";

import { HeartPulse } from "lucide-react";
import { useEffect, useState } from "react";
import { getLiffIdToken } from "@/lib/liff-client";

type Phase = "loading" | "entry" | "consent" | "busy" | "error" | "success";

export default function LiffLinkPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [typedCode, setTypedCode] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get("code")?.trim();
    if (urlCode) {
      setCode(urlCode);
      setPhase("consent");
    } else {
      setPhase("entry");
    }
  }, []);

  async function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = typedCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalized.length < 4) {
      setPhase("error");
      setMessage("กรุณากรอกรหัสให้ครบถ้วน");
      return;
    }
    setCode(normalized);
    setPhase("consent");
  }

  async function confirm() {
    setPhase("busy");
    try {
      const init = await fetch("/api/line/liff/init").then((response) => response.json());
      if (!init.ok) throw new Error("ไม่สามารถเริ่มการยืนยันตัวตนได้");

      const idToken = await getLiffIdToken(init.liffId);

      const response = await fetch("/api/line/link/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken, code, nonce: init.nonce })
      });
      const body = await response.json();
      if (!response.ok) {
        const reason = body.detail ? `${body.error}: ${body.detail}` : (body.error ?? "ผูกบัญชีไม่สำเร็จ");
        throw new Error(reason);
      }

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

        {phase === "entry" && (
          <section className="appointment-hero">
            <h2>กรอกรหัสเชื่อมบัญชี</h2>
            <p>รหัส 6 หลักจากเจ้าหน้าที่ (เช่น 3K7PQW)</p>
            <form onSubmit={submitCode} className="volunteer-form" style={{ marginBlockStart: "var(--space-md)" }}>
              <input
                value={typedCode}
                onChange={(event) => setTypedCode(event.target.value)}
                placeholder="กรอกรหัส"
                autoCapitalize="characters"
                autoComplete="off"
                style={{ textAlign: "center", fontSize: "var(--text-xl)", letterSpacing: "0.35em" }}
                aria-label="รหัสเชื่อมบัญชี"
              />
              <button className="button patient-primary" type="submit">ต่อไป</button>
            </form>
          </section>
        )}

        {phase === "error" && (
          <section className="appointment-hero">
            <h2>ไม่สามารถผูกบัญชีได้</h2>
            <p>{message}</p>
            <button className="button patient-primary" onClick={() => setPhase(code ? "consent" : "entry")}>ลองใหม่</button>
          </section>
        )}

        {phase === "consent" && (
          <section className="appointment-hero">
            <h2>ยินยอมให้เชื่อมบัญชี LINE</h2>
            <p>ระบบจะใช้ LINE เพื่อแจ้งเตือนนัดและสื่อสุขภาพ โดยไม่ส่งข้อมูลสุขภาพละเอียดผ่านข้อความ</p>
            <button className="button patient-primary" onClick={() => void confirm()}>ยินยอมและผูกบัญชี</button>
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
