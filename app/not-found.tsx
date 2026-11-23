import Link from "next/link";

export default function NotFound() {
  return <main className="login-page"><section className="login-card"><div className="login-copy"><p className="eyebrow">รพ.สต. สระโคล่</p><h1>ไม่พบหน้าที่ต้องการ</h1><p>ลิงก์นี้อาจถูกย้ายหรือไม่มีอยู่แล้ว</p></div><Link className="button primary wide" href="/">กลับหน้าภาพรวม</Link></section></main>;
}
