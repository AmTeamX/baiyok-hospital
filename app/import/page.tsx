import { redirect } from "next/navigation";

// การนำเข้าได้ย้ายไปเป็นหน้าย่อยของ "ผู้ป่วย" ที่ /patients/import แล้ว
export default function ImportPage() {
  redirect("/patients/import");
}
