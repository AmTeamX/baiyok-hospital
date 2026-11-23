"use client";

import { useParams } from "next/navigation";
import { PatientDetail } from "@/components/patient-detail";

export default function PatientDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] ?? "" : params.id ?? "";
  return <PatientDetail id={id} />;
}
