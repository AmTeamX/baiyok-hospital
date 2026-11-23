import { PatientTabs } from "@/components/patient-tabs";
import { AddPatientForm } from "@/components/add-patient-form";

export default function PatientsAddPage() {
  return (
    <div className="page-shell">
      <div className="page-heading"><div><p className="eyebrow">ผู้ป่วย</p><h1>เพิ่มผู้ป่วยและนัดรายบุคคล</h1><p>กรอกข้อมูลผู้ป่วยและวันนัดทีละราย แทนการนำเข้าไฟล์</p></div></div>
      <PatientTabs />
      <section className="panel form-section">
        <AddPatientForm />
      </section>
    </div>
  );
}
