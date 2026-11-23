import { FollowUpForm } from "@/components/follow-up-form";
import { getMissedPatient } from "@/lib/data";
import { notFound } from "next/navigation";

export default async function FollowUpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await getMissedPatient(id);
  if (!patient) notFound();
  return <div className="page-shell"><div className="page-heading compact"><div><p className="eyebrow">บันทึกกิจกรรมพยาบาล</p><h1>{patient.name}</h1><p>HN {patient.hn} · อายุ {patient.age} ปี · {patient.village}</p></div><span className="late-badge large">เลยนัด {patient.daysLate} วัน</span></div><FollowUpForm patient={patient} /></div>;
}
