"use client";

import { HeartPulse } from "lucide-react";
import { PatientRequestForm } from "@/components/patient-request-form";

export default function LiffProblemPage() {
  return (
    <div className="patient-page">
      <header className="patient-brand"><span><HeartPulse /> รพ.สต. สระโคล่</span><small>แจ้งปัญหาการมาตรวจ</small></header>
      <PatientRequestForm type="problem" />
    </div>
  );
}
