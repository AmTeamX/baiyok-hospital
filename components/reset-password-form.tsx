"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage(""); setError("");
    if (password.length < 8) { setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"); setLoading(false); return; }
    const supabase = createBrowserSupabase();
    if (!supabase) { setError("ยังไม่ได้ตั้งค่า Supabase"); setLoading(false); return; }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) setError("ลิงก์หมดอายุหรือไม่ถูกต้อง กรุณาขอรีเซ็ตรหัสผ่านใหม่");
    else setMessage("เปลี่ยนรหัสผ่านแล้ว กำลังกลับหน้าเข้าสู่ระบบ…");
    setLoading(false);
    if (!updateError) window.setTimeout(() => { window.location.href = "/login"; }, 1000);
  }

  return <form className="login-form" onSubmit={submit}><label className="field"><span>รหัสผ่านใหม่</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}<button className="button primary wide" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} />กำลังบันทึก</> : "บันทึกรหัสผ่านใหม่"}</button></form>;
}
