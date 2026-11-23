import { missedPatients } from "@/lib/demo-data";
import type { MissedPriority, MissedStatus } from "@/lib/missed";

export type FollowUpActivity = {
  id: string;
  activityType: string;
  note: string | null;
  performedBy: string | null;
  performerName: string | null;
  performedAt: string;
};

export type FollowUpDetail = {
  id: string;
  appointmentId: string;
  status: MissedStatus;
  missedReason: string | null;
  reasonNote: string | null;
  counsellingNote: string | null;
  priority: MissedPriority;
  assignedVolunteerId: string | null;
  assigneeName: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  closureReason: string | null;
  assignedAt: string | null;
  contactedAt: string | null;
  closedAt: string | null;
  returnedConfirmedAt: string | null;
  newAppointmentId: string | null;
  appointment: {
    id: string;
    appointmentAt: string;
    clinic: string;
    status: string;
    missedMarkedAt: string | null;
  };
  patient: {
    id: string;
    hn: string;
    fullName: string;
    birthDate: string | null;
    age: number;
    village: string | null;
    phone: string | null;
  };
  activities: FollowUpActivity[];
};

export type FollowUpUpdate = {
  version: number;
  status?: MissedStatus;
  missedReason?: string | null;
  reasonNote?: string | null;
  counsellingNote?: string | null;
  priority?: MissedPriority;
  assignedVolunteerId?: string | null;
  closureReason?: string | null;
};

const demoStatus: Record<string, MissedStatus> = {
  "กลับมารับบริการ": "returned",
  "นัดใหม่แล้ว": "rescheduled",
  "กำลังติดตาม": "assigned"
};

export function demoFollowUpDetail(id: string): FollowUpDetail | null {
  const item = missedPatients.find((patient) => patient.id === id);
  if (!item) return null;
  const status = demoStatus[item.status] ?? "pending";
  const assigneeName = item.assignee === "ยังไม่มอบหมาย" ? null : item.assignee;
  const appointmentAt = new Date(Date.now() - item.daysLate * 86400000).toISOString();
  return {
    id,
    appointmentId: id,
    status,
    missedReason: item.reason,
    reasonNote: null,
    counsellingNote: null,
    priority: "normal",
    assignedVolunteerId: assigneeName ? `vol-${id}` : null,
    assigneeName,
    version: 1,
    createdAt: appointmentAt,
    updatedAt: appointmentAt,
    closureReason: status === "returned" ? "กลับมารับบริการแล้ว" : null,
    assignedAt: status === "assigned" || status === "returned" || status === "rescheduled" ? appointmentAt : null,
    contactedAt: null,
    closedAt: status === "returned" ? appointmentAt : null,
    returnedConfirmedAt: status === "returned" ? appointmentAt : null,
    newAppointmentId: null,
    appointment: { id, appointmentAt, clinic: "คลินิกความดันโลหิตสูง", status: "missed", missedMarkedAt: appointmentAt },
    patient: { id, hn: item.hn, fullName: item.name, birthDate: null, age: item.age, village: item.village, phone: null },
    activities: []
  };
}

export function ageFromBirthDate(value: string | null): number {
  if (!value) return 0;
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1;
  return age;
}
