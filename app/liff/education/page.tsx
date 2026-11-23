"use client";

import { HeartPulse, MessageCircleQuestion, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";
import { feedbackForAnswer, type HealthContent, type HealthQuestion } from "@/lib/patient";

function QuestionCard({ question, contentVersion }: { question: HealthQuestion; contentVersion: number }) {
  const [selected, setSelected] = useState("");
  const [saved, setSaved] = useState(false);

  function choose(value: string) {
    setSelected(value);
    setSaved(false);
    void (async () => {
      try {
        await fetch("/api/patient/me/health-answers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ questionId: question.id, selectedValue: value, contentVersion })
        });
        setSaved(true);
      } catch {
        // Recording is best-effort; feedback is still shown immediately.
      }
    })();
  }

  return (
    <fieldset className="volunteer-result-grid">
      <legend>{question.prompt}</legend>
      {question.options.map((option) => (
        <label key={option.value} className={selected === option.value ? "is-selected" : ""}>
          <input type="radio" name={question.id} value={option.value} checked={selected === option.value} onChange={() => choose(option.value)} />
          <span>{option.label}</span>
        </label>
      ))}
      {selected && (
        <p className="patient-feedback" data-correct={question.options.find((option) => option.value === selected)?.correct}>
          {feedbackForAnswer(question, selected)}
        </p>
      )}
      {saved && <small className="patient-feedback-note">บันทึกคำตอบแล้ว</small>}
    </fieldset>
  );
}

export default function LiffEducationPage() {
  const [contents, setContents] = useState<HealthContent[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/patient/me/health-content");
        const body = await response.json();
        if (response.status === 401 || response.status === 403) {
          window.location.href = "/liff/context";
          return;
        }
        if (!response.ok) throw new Error(body.error ?? "unauthorized");
        setContents(body.contents ?? []);
        setPhase("ready");
      } catch {
        setPhase("error");
      }
    })();
  }, []);

  return (
    <div className="patient-page">
      <header className="patient-brand"><span><HeartPulse /> รพ.สต. สระโคล่</span><small>ความรู้เรื่องความดัน</small></header>
      <main className="patient-content volunteer-detail">
        {phase === "loading" && <p className="volunteer-hint">กำลังโหลด…</p>}

        {phase === "error" && (
          <section className="appointment-hero">
            <h2>โหลดความรู้ไม่สำเร็จ</h2>
            <p>กรุณาลองใหม่ภายหลัง</p>
            <a className="button patient-primary" href="/liff/context">กลับไปเลือกโหมด</a>
          </section>
        )}

        {phase === "ready" && contents.map((content, index) => (
          <section key={content.id} className="patient-lesson">
            <span className="lesson-number">0{index + 1}</span>
            <Stethoscope size={28} />
            <h2>{content.title}</h2>
            <p>{content.body}</p>
            {content.questions.map((question) => (
              <QuestionCard key={question.id} question={question} contentVersion={content.version} />
            ))}
          </section>
        ))}

        {phase === "ready" && (
          <section className="nurse-cta">
            <div>
              <h2><MessageCircleQuestion size={20} /> ยังไม่แน่ใจ หรือมีปัญหาเรื่องยา?</h2>
              <p>ส่งคำขอให้พยาบาลติดต่อกลับ ระบบจะไม่เปลี่ยนวันนัดให้อัตโนมัติ</p>
            </div>
            <a className="button on-dark" href="/liff/consult">ขอปรึกษาพยาบาล</a>
          </section>
        )}
      </main>
    </div>
  );
}
