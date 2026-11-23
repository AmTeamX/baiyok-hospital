import Link from "next/link";
import { StatusScreen } from "@/components/status-screen";

export default function UnauthorizedPage() {
  return <StatusScreen title="ไม่มีสิทธิ์เข้าถึงหน้านี้" description="บัญชีนี้ยังไม่ได้รับสิทธิ์สำหรับระบบเจ้าหน้าที่ กรุณาติดต่อผู้ดูแลระบบ หรือเข้าสู่ระบบด้วยบัญชีอื่น"><Link className="button primary" href="/login">กลับไปเข้าสู่ระบบ</Link></StatusScreen>;
}
