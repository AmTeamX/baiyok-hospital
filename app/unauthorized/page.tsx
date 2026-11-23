import Link from "next/link";

export default function UnauthorizedPage() {
  return <main className="login-page"><section className="login-card"><div className="login-copy"><p className="eyebrow">รพ.สต. สระโคล่</p><h1>ไม่มีสิทธิ์เข้าถึงหน้านี้</h1><p>บัญชีนี้ยังไม่ได้รับสิทธิ์สำหรับระบบเจ้าหน้าที่ กรุณาติดต่อผู้ดูแลระบบ</p></div><Link className="button primary wide" href="/login">กลับไปหน้าเข้าสู่ระบบ</Link></section></main>;
}
