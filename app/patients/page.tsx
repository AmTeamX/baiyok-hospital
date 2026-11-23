import { Suspense } from "react";
import { PatientTabs } from "@/components/patient-tabs";
import { PatientRegistry } from "@/components/patient-registry";

export default function PatientsPage() {
  return (
    <div className="page-shell">
      <div className="page-heading"><div><p className="eyebrow">ผู้ป่วย</p><h1>ทะเบียนผู้ป่วย</h1><p>ค้นหาและจัดการข้อมูลผู้ป่วยทั้งหมด</p></div></div>
      <PatientTabs />
      <Suspense fallback={<div className="state-banner" role="status">กำลังโหลด…</div>}>
        <PatientRegistry />
      </Suspense>
    </div>
  );
}
