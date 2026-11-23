import { redirect } from "next/navigation";

// ย้ายหน้านำเข้าไปเป็น sub-tab ใต้ "ผู้ป่วย" ที่ /patients/import แล้ว
export default function MissedImportPage() {
  redirect("/patients/import");
}
