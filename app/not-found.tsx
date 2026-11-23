import Link from "next/link";
import { StatusScreen } from "@/components/status-screen";

export default function NotFound() {
  return <StatusScreen title="ไม่พบหน้าที่ต้องการ" description="ลิงก์นี้อาจถูกย้ายหรือไม่มีอยู่แล้ว กลับไปเริ่มต้นจากศูนย์งานได้"><Link className="button primary" href="/">กลับศูนย์งาน</Link></StatusScreen>;
}
