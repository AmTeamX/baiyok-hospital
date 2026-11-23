"use client";

import { HeartPulse, LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

function LoginFields() {
  const params = useSearchParams(); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const supabase = createBrowserSupabase(); const form = new FormData(event.currentTarget);
    if (!supabase) { setError("ยังไม่ได้ตั้งค่า Supabase กรุณาใช้โหมดสาธิตที่หน้าแรก"); setLoading(false); return; }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
    if (signInError) { setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง"); setLoading(false); return; }
    window.location.href = params.get("next") || "/";
  }
  async function requestReset() {
    const email = window.prompt("กรอกอีเมลเจ้าหน้าที่");
    if (!email) return;
    const supabase = createBrowserSupabase();
    if (!supabase) { setError("ยังไม่ได้ตั้งค่า Supabase"); return; }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setError(resetError ? "ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบอีเมล" : "ส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมลแล้ว");
  }
  return <form className="login-form" onSubmit={submit}><span className="login-mark"><HeartPulse /></span><label className="field"><span>อีเมลเจ้าหน้าที่</span><input type="email" name="email" autoComplete="email" required placeholder="name@hospital.go.th" /></label><label className="field"><span>รหัสผ่าน</span><input type="password" name="password" autoComplete="current-password" required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary wide" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} />กำลังเข้าสู่ระบบ</> : "เข้าสู่ระบบ"}</button><button type="button" className="button ghost wide" onClick={requestReset}>ลืมรหัสผ่าน</button></form>;
}

export function LoginForm() { return <Suspense fallback={<p>กำลังโหลด…</p>}><LoginFields /></Suspense>; }
