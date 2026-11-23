export type VolunteerResultCode =
  | "contacted_will_come"
  | "wants_reschedule"
  | "travel_difficulty"
  | "no_escort"
  | "forgot_misunderstood"
  | "no_symptoms_felt_fine"
  | "stopped_medication"
  | "refused"
  | "moved_elsewhere"
  | "unable_to_contact"
  | "needs_nurse";

export type VolunteerChannel = "phone" | "visit" | "line" | "other";

export type VolunteerTaskStatus = "pending" | "assigned" | "contacted" | "rescheduled" | "returned" | "closed";
export type VolunteerTaskPriority = "normal" | "high" | "urgent";

export function volunteerLoadErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    unauthorized: "การเข้าสู่ระบบหมดอายุ กรุณาเปิดเมนูงานของฉันใหม่",
    context_required: "กรุณาเลือกโหมด อสม. เพื่อดูงานของคุณ",
    context_revoked: "บัญชี อสม. ถูกถอนการเชื่อม กรุณาติดต่อเจ้าหน้าที่",
    not_volunteer: "ไม่พบข้อมูล อสม. สำหรับบัญชีนี้ กรุณาติดต่อเจ้าหน้าที่",
    inactive: "บัญชี อสม. ถูกระงับ กรุณาติดต่อเจ้าหน้าที่",
    database_required: "ระบบข้อมูลยังไม่พร้อม กรุณาลองใหม่ภายหลัง",
    query_failed: "โหลดข้อมูลจากระบบไม่สำเร็จ กรุณาลองใหม่"
  };
  return messages[code] ?? "เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่";
}

export const VOLUNTEER_RESULT_CODES: VolunteerResultCode[] = [
  "contacted_will_come",
  "wants_reschedule",
  "travel_difficulty",
  "no_escort",
  "forgot_misunderstood",
  "no_symptoms_felt_fine",
  "stopped_medication",
  "refused",
  "moved_elsewhere",
  "unable_to_contact",
  "needs_nurse"
];

export const VOLUNTEER_CHANNELS: VolunteerChannel[] = ["phone", "visit", "line", "other"];

export const VOLUNTEER_RESULT_LABELS: Record<VolunteerResultCode, string> = {
  contacted_will_come: "ติดต่อได้และยืนยันว่าจะมา",
  wants_reschedule: "ต้องการนัดใหม่",
  travel_difficulty: "เดินทางไม่สะดวก",
  no_escort: "ไม่มีผู้พามา",
  forgot_misunderstood: "ลืมนัด/เข้าใจวันผิด",
  no_symptoms_felt_fine: "ไม่มีอาการจึงคิดว่าไม่ต้องมา",
  stopped_medication: "หยุดยา/ซื้อยาเอง",
  refused: "ปฏิเสธการติดตาม",
  moved_elsewhere: "ย้ายที่อยู่/รับบริการที่อื่น",
  unable_to_contact: "ติดต่อไม่ได้",
  needs_nurse: "มีอาการที่ต้องให้พยาบาลประเมิน"
};

export const VOLUNTEER_CHANNEL_LABELS: Record<VolunteerChannel, string> = {
  phone: "โทรศัพท์",
  visit: "เยี่ยมบ้าน",
  line: "LINE",
  other: "อื่น ๆ"
};

export const VOLUNTEER_TASK_STATUS_LABELS: Record<VolunteerTaskStatus, string> = {
  pending: "รอดำเนินการ",
  assigned: "รอดำเนินการ",
  contacted: "ติดตามแล้ว",
  rescheduled: "นัดใหม่แล้ว",
  returned: "กลับมารับบริการ",
  closed: "ปิดเคส"
};

export const VOLUNTEER_PRIORITY_LABELS: Record<VolunteerTaskPriority, string> = {
  normal: "ปกติ",
  high: "สำคัญ",
  urgent: "เร่งด่วน"
};

export function isValidVolunteerResult(value: unknown): value is VolunteerResultCode {
  return typeof value === "string" && (VOLUNTEER_RESULT_CODES as string[]).includes(value);
}

export function isValidVolunteerChannel(value: unknown): value is VolunteerChannel {
  return typeof value === "string" && (VOLUNTEER_CHANNELS as string[]).includes(value);
}

/** `needs_nurse` is the only result that auto-escalates the follow-up priority. */
export function resultCodeEscalates(code: VolunteerResultCode): boolean {
  return code === "needs_nurse";
}

/** Result codes that indicate the volunteer could not reach the patient. */
export function resultCodeIsUnreached(code: VolunteerResultCode): boolean {
  return code === "unable_to_contact" || code === "moved_elsewhere";
}

export type VolunteerTask = {
  id: string;
  status: VolunteerTaskStatus;
  priority: VolunteerTaskPriority;
  assignedAt: string | null;
  contactedAt: string | null;
  missedReason: string | null;
  overdueSla: boolean;
  patient: {
    fullName: string;
    village: string | null;
    phone: string | null;
  };
  appointment: {
    appointmentAt: string;
    clinic: string;
  };
};

export type VolunteerTaskFilter = "all" | "new" | "in_progress" | "done" | "urgent" | "open";

export const VOLUNTEER_TASK_FILTERS: VolunteerTaskFilter[] = ["all", "new", "in_progress", "done", "urgent", "open"];

export function isValidVolunteerTaskFilter(value: unknown): value is VolunteerTaskFilter {
  return typeof value === "string" && (VOLUNTEER_TASK_FILTERS as string[]).includes(value);
}

/**
 * Map a UI filter to the set of follow-up statuses it selects. `urgent` is
 * handled separately because it filters on priority rather than status.
 */
export function taskFilterToStatuses(filter: VolunteerTaskFilter): VolunteerTaskStatus[] {
  switch (filter) {
    case "new":
      return ["assigned"];
    case "in_progress":
      return ["contacted"];
    case "done":
      return ["returned", "closed", "rescheduled"];
    case "open":
      return ["assigned", "contacted"];
    case "urgent":
      return ["assigned", "contacted"];
    default:
      return ["pending", "assigned", "contacted", "rescheduled", "returned", "closed"];
  }
}

/** A task is over SLA when it is still assigned (no result yet) past the unit's sla window. */
export function isOverdueSla(status: VolunteerTaskStatus, assignedAt: string | null, slaHours: number, now = new Date()): boolean {
  if (status !== "assigned" || !assignedAt) return false;
  const assigned = new Date(assignedAt).getTime();
  if (Number.isNaN(assigned)) return false;
  return assigned <= now.getTime() - slaHours * 3_600_000;
}

type MaybeMany<T> = T | T[] | null | undefined;

export type VolunteerTaskRow = {
  id: string;
  status: string;
  priority: string;
  assigned_at: string | null;
  contacted_at: string | null;
  missed_reason: string | null;
  appointments: MaybeMany<{ appointment_at: string; clinic: string; patients: MaybeMany<{ full_name: string; village: string | null; phone: string | null }> }>;
};

function first<T>(value: MaybeMany<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Map a raw DB row (nested relations normalized) to a minimal volunteer task. */
export function mapVolunteerTaskRow(row: VolunteerTaskRow, slaHours: number, now = new Date()): VolunteerTask {
  const appointment = first(row.appointments);
  const patient = first(appointment?.patients);
  const status = (row.status as VolunteerTaskStatus) ?? "pending";
  return {
    id: row.id,
    status,
    priority: (row.priority as VolunteerTaskPriority) ?? "normal",
    assignedAt: row.assigned_at,
    contactedAt: row.contacted_at,
    missedReason: row.missed_reason,
    overdueSla: isOverdueSla(status, row.assigned_at, slaHours, now),
    patient: { fullName: patient?.full_name ?? "", village: patient?.village ?? null, phone: patient?.phone ?? null },
    appointment: { appointmentAt: appointment?.appointment_at ?? "", clinic: appointment?.clinic ?? "" }
  };
}
