"use client";

import { HeartPulse } from "lucide-react";
import { PatientRequestForm } from "@/components/patient-request-form";

export default function LiffConsultPage() {
  return (
    <div className="patient-page">
      <header className="patient-brand"><span><HeartPulse /> รพ.สต. สระโคล่</span><small>ขอคำปรึกษาพยาบาล</small></header>
      <PatientRequestForm type="consult" />
    </div>
  );
}
