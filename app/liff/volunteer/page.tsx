"use client";

import { HeartPulse, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";
import { VolunteerTaskList } from "@/components/volunteer-task-list";
import { volunteerLoadErrorMessage } from "@/lib/volunteer";

type Tab = { key: string; label: string };

const tabs: Tab[] = [
  { key: "new", label: "ใหม่" },
  { key: "in_progress", label: "กำลังทำ" },
  { key: "done", label: "เสร็จแล้ว" },
  { key: "urgent", label: "เร่งด่วน" }
];

export default function LiffVolunteerPage() {
  const [name, setName] = useState("");
  const [boot, setBoot] = useState<"loading" | "ready" | "error">("loading");
  const [active, setActive] = useState("new");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const filter = new URLSearchParams(window.location.search).get("filter");
    if (filter && tabs.some((tab) => tab.key === filter)) setActive(filter);
    void (async () => {
      try {
        const response = await fetch("/api/volunteer/me");
        const body = await response.json();
        if (response.status === 401 || (response.status === 403 && body.error === "context_required")) {
          window.location.replace("/liff/link?destination=context&role=volunteer");
          return;
        }
        if (!response.ok) throw new Error(body.error ?? "unauthorized");
        setName(body.volunteer?.fullName ?? "");
        setBoot("ready");
      } catch (error) {
        setMessage(volunteerLoadErrorMessage(error instanceof Error ? error.message : "network"));
        setBoot("error");
      }
    })();
  }, []);

  return (
    <div className="patient-page">
      <header className="patient-brand">
        <span><Stethoscope /> งานของฉัน</span>
        <small>{name || "อสม."}</small>
      </header>

      {boot === "loading" && <p className="volunteer-hint">กำลังโหลด…</p>}
      {boot === "error" && (
        <main className="patient-content">
          <section className="appointment-hero">
            <h2>เปิดงานของฉันไม่สำเร็จ</h2>
            <p>{message}</p>
            <button className="button patient-primary" onClick={() => window.location.reload()}>ลองใหม่</button>
          </section>
        </main>
      )}

      {boot === "ready" && (
        <>
          <nav className="volunteer-tabs patient-content" aria-label="หมวดงาน">
            {tabs.map((tab) => (
              <button key={tab.key} aria-pressed={active === tab.key} onClick={() => setActive(tab.key)}>
                {tab.label}
              </button>
            ))}
          </nav>
          <VolunteerTaskList filter={active} />
          <div className="patient-content" style={{ display: "grid", gap: "var(--space-sm)" }}>
            <a className="button patient-primary" href="/liff/volunteer/contact-nurse"><HeartPulse /> ติดต่อพยาบาล</a>
          </div>
        </>
      )}
    </div>
  );
}
