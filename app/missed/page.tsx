import { redirect } from "next/navigation";

// ย้ายทะเบียนผู้ขาดนัดไปเป็น sub-tab ใต้ "ผู้ป่วย" ที่ /patients/missed แล้ว
export default function MissedPage() {
  redirect("/patients/missed");
}
