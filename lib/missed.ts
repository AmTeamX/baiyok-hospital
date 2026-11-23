import { missedPatients } from "@/lib/demo-data";

export type MissedStatus = "pending" | "assigned" | "contacted" | "rescheduled" | "returned" | "closed";
export type MissedPriority = "normal" | "high" | "urgent";
export type SortKey = "appointment_at" | "updated_at" | "priority" | "days_late" | "full_name";

export const MISSED_STATUSES: MissedStatus[] = ["pending", "assigned", "contacted", "rescheduled", "returned", "closed"];
export const MISSED_PRIORITIES: MissedPriority[] = ["normal", "high", "urgent"];
export const SORT_KEYS: SortKey[] = ["appointment_at", "updated_at", "priority", "days_late", "full_name"];

export type MissedRow = {
  id: string;
  followUpId: string | null;
  appointmentId: string;
  hn: string;
  fullName: string;
  age: number;
  village: string;
  appointmentAt: string;
  clinic: string;
  daysLate: number;
  status: MissedStatus;
  missedReason: string | null;
  priority: MissedPriority;
  assignedVolunteerId: string | null;
  assigneeName: string | null;
  unassigned: boolean;
  overdue: boolean;
  version: number;
};

export type VolunteerOption = { id: string; fullName: string };

export type MissedFilters = {
  q: string;
  status: MissedStatus | null;
  area: string | null;
  assignee: string | null;
  unassignedOnly: boolean;
  priority: MissedPriority | null;
  from: string | null;
  to: string | null;
  page: number;
  pageSize: number;
  sort: SortKey;
  order: "asc" | "desc";
};

export const DEFAULT_PAGE_SIZE = 25;

export function defaultFilters(): MissedFilters {
  return { q: "", status: null, area: null, assignee: null, unassignedOnly: false, priority: null, from: null, to: null, page: 1, pageSize: DEFAULT_PAGE_SIZE, sort: "appointment_at", order: "asc" };
}

function asStatus(value: string | null): MissedStatus | null {
  return value && (MISSED_STATUSES as string[]).includes(value) ? (value as MissedStatus) : null;
}
function asPriority(value: string | null): MissedPriority | null {
  return value && (MISSED_PRIORITIES as string[]).includes(value) ? (value as MissedPriority) : null;
}
function asSort(value: string | null): SortKey {
  return value && (SORT_KEYS as string[]).includes(value) ? (value as SortKey) : "appointment_at";
}
function asDate(value: string | null): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
function asPositiveInt(value: string | null, fallback: number, max = 100): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function parseMissedQuery(params: URLSearchParams): MissedFilters {
  const base = defaultFilters();
  const unassignedOnly = params.get("unassigned") === "1";
  return {
    q: (params.get("q") ?? "").trim().slice(0, 80),
    status: asStatus(params.get("status")),
    area: (params.get("area") ?? "").trim().slice(0, 120) || null,
    assignee: params.get("assignee") ?? null,
    unassignedOnly,
    priority: asPriority(params.get("priority")),
    from: asDate(params.get("from")),
    to: asDate(params.get("to")),
    page: asPositiveInt(params.get("page"), 1),
    pageSize: asPositiveInt(params.get("pageSize"), DEFAULT_PAGE_SIZE),
    sort: asSort(params.get("sort")),
    order: params.get("order") === "desc" ? "desc" : "asc"
  };
}

function thaiStatusToEnum(status: string): MissedStatus {
  if (status === "กลับมารับบริการ") return "returned";
  if (status === "นัดใหม่แล้ว") return "rescheduled";
  if (status === "กำลังติดตาม") return "assigned";
  return "pending";
}

export function demoMissedRows(): MissedRow[] {
  const now = Date.now();
  return missedPatients.map((item) => {
    const appointmentAt = new Date(now - item.daysLate * 86400000).toISOString();
    const status = thaiStatusToEnum(item.status);
    const assigneeName = item.assignee === "ยังไม่มอบหมาย" ? null : item.assignee;
    return {
      id: item.id,
      followUpId: item.id,
      appointmentId: item.id,
      hn: item.hn,
      fullName: item.name,
      age: item.age,
      village: item.village,
      appointmentAt,
      clinic: "คลินิกความดันโลหิตสูง",
      daysLate: item.daysLate,
      status,
      missedReason: item.reason,
      priority: "normal",
      assignedVolunteerId: assigneeName ? `vol-${item.id}` : null,
      assigneeName,
      unassigned: assigneeName === null,
      overdue: (status === "pending" || status === "assigned") && item.daysLate >= 3,
      version: 1
    };
  });
}

export function demoVolunteers(rows: MissedRow[]): VolunteerOption[] {
  const seen = new Map<string, VolunteerOption>();
  for (const row of rows) {
    if (row.assigneeName && row.assignedVolunteerId && !seen.has(row.assignedVolunteerId)) {
      seen.set(row.assignedVolunteerId, { id: row.assignedVolunteerId, fullName: row.assigneeName });
    }
  }
  return [...seen.values()];
}

export function demoAreas(rows: MissedRow[]): string[] {
  return [...new Set(rows.map((row) => row.village).filter(Boolean))].sort();
}

export function applyMissedFilters(rows: MissedRow[], filters: MissedFilters): { rows: MissedRow[]; total: number } {
  const q = filters.q.toLowerCase();
  const filtered = rows.filter((row) => {
    if (q && !(row.fullName.toLowerCase().includes(q) || row.hn.toLowerCase().includes(q) || row.village.toLowerCase().includes(q))) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.area && !row.village.includes(filters.area)) return false;
    if (filters.assignee && row.assignedVolunteerId !== filters.assignee) return false;
    if (filters.unassignedOnly && !row.unassigned) return false;
    if (filters.priority && row.priority !== filters.priority) return false;
    if (filters.from && row.appointmentAt.slice(0, 10) < filters.from) return false;
    if (filters.to && row.appointmentAt.slice(0, 10) > filters.to) return false;
    return true;
  });

  const direction = filters.order === "desc" ? -1 : 1;
  const sorted = [...filtered].sort((a, b) => {
    let comparison = 0;
    if (filters.sort === "full_name") comparison = a.fullName.localeCompare(b.fullName, "th");
    else if (filters.sort === "priority") comparison = priorityRank(a.priority) - priorityRank(b.priority);
    else if (filters.sort === "days_late") comparison = a.daysLate - b.daysLate;
    else if (filters.sort === "updated_at") comparison = 0;
    else comparison = a.appointmentAt.localeCompare(b.appointmentAt);
    if (comparison === 0) comparison = a.id.localeCompare(b.id);
    return comparison * direction;
  });

  const start = (filters.page - 1) * filters.pageSize;
  return { rows: sorted.slice(start, start + filters.pageSize), total: filtered.length };
}

function priorityRank(priority: MissedPriority): number {
  return priority === "urgent" ? 0 : priority === "high" ? 1 : 2;
}

export function mapMissedRowFromRpc(value: Record<string, unknown>): MissedRow {
  const followUpId = typeof value.follow_up_id === "string" ? value.follow_up_id : null;
  const appointmentId = String(value.appointment_id ?? "");
  return {
    id: followUpId ?? appointmentId,
    followUpId,
    appointmentId,
    hn: String(value.hn ?? ""),
    fullName: String(value.full_name ?? ""),
    age: Number(value.age ?? 0),
    village: String(value.village ?? ""),
    appointmentAt: String(value.appointment_at ?? ""),
    clinic: String(value.clinic ?? ""),
    daysLate: Number(value.days_late ?? 0),
    status: (value.status as MissedStatus) ?? "pending",
    missedReason: typeof value.missed_reason === "string" ? value.missed_reason : null,
    priority: (value.priority as MissedPriority) ?? "normal",
    assignedVolunteerId: typeof value.assigned_volunteer_id === "string" ? value.assigned_volunteer_id : null,
    assigneeName: typeof value.assignee_name === "string" ? value.assignee_name : null,
    unassigned: Boolean(value.unassigned),
    overdue: Boolean(value.overdue),
    version: Number(value.version ?? 1)
  };
}
