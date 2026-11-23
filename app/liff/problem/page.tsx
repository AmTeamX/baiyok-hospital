"use client";

import { HeartPulse } from "lucide-react";
import { PatientRequestForm } from "@/components/patient-request-form";
import { useEffect, useState } from "react";

export default function LiffProblemPage() {
  const [appointmentId, setAppointmentId] = useState<string | undefined>();
  const [requestType, setRequestType] = useState<"reschedule" | "problem">("problem");
  useEffect(() => {
    setAppointmentId(new URLSearchParams(window.location.search).get("appointmentId") ?? undefined);
    setRequestType(new URLSearchParams(window.location.search).get("type") === "reschedule" ? "reschedule" : "problem");
  }, []);

  return (
    <div className="patient-page">
      <header className="patient-brand"><span><HeartPulse /> รพ.สต. สระโคล่</span><small>แจ้งปัญหาการมาตรวจ</small></header>
      <PatientRequestForm type="problem" appointmentId={appointmentId} requestTypeLabel={requestType === "reschedule" ? "ขอเลื่อนนัด" : undefined} />
    </div>
  );
}
