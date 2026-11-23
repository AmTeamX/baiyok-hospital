import { ResetPasswordForm } from "@/components/reset-password-form";

export default function ResetPasswordPage() {
  return <div className="login-page"><section className="login-card"><div className="login-copy"><p className="eyebrow">รพ.สต. สระโคล่</p><h1>ตั้งรหัสผ่านใหม่</h1><p>ใช้ลิงก์จากอีเมล Supabase แล้วตั้งรหัสผ่านใหม่สำหรับบัญชีเจ้าหน้าที่</p></div><ResetPasswordForm /></section></div>;
}
