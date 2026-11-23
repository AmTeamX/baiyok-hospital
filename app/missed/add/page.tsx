import { redirect } from "next/navigation";

// ย้ายหน้าเพิ่มรายบุคคลไปเป็น sub-tab ใต้ "ผู้ป่วย" ที่ /patients/add แล้ว
export default function MissedAddPage() {
  redirect("/patients/add");
}
