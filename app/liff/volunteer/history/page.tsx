"use client";

import { Stethoscope } from "lucide-react";
import { VolunteerTaskList } from "@/components/volunteer-task-list";

export default function LiffVolunteerHistoryPage() {
  return (
    <div className="patient-page">
      <header className="patient-brand">
        <span><Stethoscope /> ประวัติงาน</span>
        <small><a href="/liff/volunteer">งานของฉัน</a></small>
      </header>
      <VolunteerTaskList filter="done" />
    </div>
  );
}
