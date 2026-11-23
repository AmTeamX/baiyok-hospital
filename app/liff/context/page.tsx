"use client";

import { HeartPulse, Stethoscope, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

type Context = { linkId: string; role: "patient" | "volunteer" };

export default function LiffContextPage() {
  const [contexts, setContexts] = useState<Context[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "busy">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const response = await fetch("/api/line/me/contexts");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "unauthorized");
      setContexts(body.contexts ?? []);
      setPhase("ready");
    } catch {
      setPhase("error");
      setMessage("ยังไม่พบบัญชีที่ผูกไว้ กรุณาผูกบัญชีก่อน");
    }
  }

  async function choose(context: Context) {
    setPhase("busy");
    try {
      const response = await fetch("/api/line/me/context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ linkId: context.linkId, role: context.role })
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "switch_failed");
      }
      const home = context.role === "volunteer" ? "/liff/volunteer" : "/liff/appointments";
      window.location.href = home;
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "ไม่สามารถสลับโหมดได้");
    }
  }

  return (
    <div className="patient-page">
      <header className="patient-brand"><span><HeartPulse /> รพ.สต. สระโคล่</span><small>เลือกโหมดการใช้งาน</small></header>
      <main className="patient-content">
        {phase === "loading" && <p>กำลังโหลด…</p>}
        {phase === "error" && (
          <section className="appointment-hero">
            <h2>สลับโหมดไม่ได้</h2>
            <p>{message}</p>
            <a className="button patient-primary" href="/liff/link">ผูกบัญชี</a>
          </section>
        )}
        {phase === "busy" && <p>กำลังสลับโหมด…</p>}
        {phase === "ready" && (
          <section className="context-picker">
            <h2>คุณใช้งานในฐานะใด</h2>
            <p>ข้อมูลและสิทธิ์ของแต่ละโหมดจะถูกแยกออกจากกัน</p>
            <div style={{ display: "grid", gap: "var(--space-sm)", marginBlock: "var(--space-md)" }}>
              {contexts.map((context) => (
                <button key={context.linkId} className="context-choice" onClick={() => choose(context)}>
                  {context.role === "volunteer" ? <Stethoscope /> : <UserRound />}
                  <span><strong>{context.role === "volunteer" ? "โหมด อสม." : "โหมดผู้ป่วย"}</strong><small>{context.role === "volunteer" ? "รับงานและบันทึกผลติดตาม" : "ดูวันนัดและติดต่อหน่วยบริการ"}</small></span><span aria-hidden="true">›</span>
                </button>
              ))}
            </div>
            {contexts.length === 0 && <div className="empty-state"><strong>ยังไม่มีบัญชีที่เชื่อมไว้</strong><a className="button primary" href="/liff/link">ผูกบัญชี LINE</a></div>}
          </section>
        )}
      </main>
    </div>
  );
}
