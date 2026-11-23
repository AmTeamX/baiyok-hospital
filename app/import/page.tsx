import { ImportWorkspace } from "@/components/import-workspace";

export default function ImportPage() {
  return <div className="page-shell"><div className="page-heading"><div><p className="eyebrow">ข้อมูลบริการ</p><h1>นำเข้ารายการนัด</h1><p>รองรับ Excel และ CSV ระบบจะตรวจหัวตารางก่อนบันทึกทุกครั้ง</p></div></div><ImportWorkspace /></div>;
}
