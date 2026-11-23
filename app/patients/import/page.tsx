import { PatientTabs } from "@/components/patient-tabs";
import { ImportWorkspace } from "@/components/import-workspace";

export default function PatientsImportPage() {
  return (
    <div className="page-shell">
      <div className="page-heading"><div><p className="eyebrow">ผู้ป่วย</p><h1>นำเข้ารายการนัด</h1><p>รองรับ Excel และ CSV ระบบจะตรวจหัวตารางก่อนบันทึกทุกครั้ง</p></div></div>
      <PatientTabs />
      <ImportWorkspace />
    </div>
  );
}
