import { Suspense } from "react";
import { PatientTabs } from "@/components/patient-tabs";
import { PatientRegistry } from "@/components/patient-registry";

export default function PatientsPage() {
  return (
    <div className="page-shell">
      <div className="page-heading"><div><p className="eyebrow">Patient workspace</p><h1>ผู้ป่วย</h1><p>ค้นหาประวัติ ตรวจสถานะนัด และเข้าสู่งานติดตามโดยไม่ต้องไล่หลายหน้าจอ</p></div></div>
      <PatientTabs />
      <Suspense fallback={<div className="state-banner" role="status">กำลังโหลด…</div>}>
        <PatientRegistry />
      </Suspense>
    </div>
  );
}
