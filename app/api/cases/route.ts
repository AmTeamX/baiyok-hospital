import { NextResponse } from "next/server";
import { requireClinicalStaff } from "@/lib/supabase/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { MISSED_PRIORITIES, MISSED_STATUSES } from "@/lib/missed";
import { dispatchNotifications } from "@/lib/notification-dispatch";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function GET(request: Request) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasSupabaseAdmin()) return NextResponse.json({ mode: "demo", cases: [], total: 0 });
  if (!staff.serviceUnitId) return NextResponse.json({ error: "service_unit_required" }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const requestedPage = Number(params.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
  const status = params.get("status");
  const assignee = params.get("assignee");
  const q = (params.get("q") ?? "").replace(/[%,_().]/g, "").trim().slice(0, 80);
  const db = createAdminClient();
  let query = db.from("follow_ups").select("id, status, priority, missed_reason, updated_at, assigned_volunteer_id, appointment:appointments!follow_ups_appointment_id_fkey!inner(appointment_at, clinic, patient:patients!inner(id, full_name, hn, village, service_unit_id)), assignee:profiles!follow_ups_assigned_volunteer_id_fkey(full_name)", { count: "exact" }).eq("appointment.patient.service_unit_id", staff.serviceUnitId);
  if (status && MISSED_STATUSES.includes(status as typeof MISSED_STATUSES[number])) query = query.eq("status", status as typeof MISSED_STATUSES[number]);
  if (assignee === "unassigned") query = query.is("assigned_volunteer_id", null);
  else if (assignee && uuid.test(assignee)) query = query.eq("assigned_volunteer_id", assignee);
  if (q) query = query.or(`full_name.ilike.%${q}%,hn.ilike.%${q}%`, { referencedTable: "appointment.patient" });
  const { data, error, count } = await query.order("updated_at", { ascending: false }).range((page - 1) * 25, page * 25 - 1);
  if (error) return NextResponse.json({ error: "อ่านรายการเคสไม่สำเร็จ" }, { status: 500 });
  const ids = (data ?? []).map((row) => row.id);
  const { data: notices, error: noticeError } = ids.length ? await db.from("notification_logs").select("follow_up_id, recipient_profile_id, status").in("follow_up_id", ids).eq("kind", "follow_up_assigned").order("created_at", { ascending: false }) : { data: [], error: null };
  if (noticeError) return NextResponse.json({ error: "อ่านสถานะ LINE ไม่สำเร็จ" }, { status: 500 });
  const notificationMap = new Map<string, string>();
  const assigneeMap = new Map((data ?? []).map((row) => [row.id, row.assigned_volunteer_id]));
  for (const notice of notices ?? []) if (notice.follow_up_id && assigneeMap.get(notice.follow_up_id) === notice.recipient_profile_id && !notificationMap.has(notice.follow_up_id)) notificationMap.set(notice.follow_up_id, notice.status);
  const cases = (data ?? []).map((row) => {
    const appointment = Array.isArray(row.appointment) ? row.appointment[0] : row.appointment;
    const patient = Array.isArray(appointment?.patient) ? appointment.patient[0] : appointment?.patient;
    const assignee = Array.isArray(row.assignee) ? row.assignee[0] : row.assignee;
    return { id: row.id, status: row.status, priority: row.priority, reason: row.missed_reason, updatedAt: row.updated_at, patient: { id: patient?.id, name: patient?.full_name, hn: patient?.hn, village: patient?.village }, appointment: { at: appointment?.appointment_at, clinic: appointment?.clinic }, assignee: row.assigned_volunteer_id ? { id: row.assigned_volunteer_id, name: assignee?.full_name ?? "ไม่ระบุชื่อ" } : null, notificationStatus: notificationMap.get(row.id) ?? null };
  });
  return NextResponse.json({ mode: "database", cases, total: count ?? 0 });
}

export async function POST(request: Request) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasSupabaseAdmin() || !staff.userId || !staff.serviceUnitId) return NextResponse.json({ error: "ต้องเชื่อมฐานข้อมูลและหน่วยบริการก่อนสร้างเคส" }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!uuid.test(body?.appointmentId ?? "") || !MISSED_PRIORITIES.includes(body?.priority) || (body?.volunteerId && !uuid.test(body.volunteerId))) return NextResponse.json({ error: "กรุณาเลือกนัดและความเร่งด่วนให้ถูกต้อง" }, { status: 422 });
  const { data, error } = await createAdminClient().rpc("create_case", { p_appointment_id: body.appointmentId, p_volunteer_id: body.volunteerId || null, p_priority: body.priority, p_note: typeof body.note === "string" ? body.note.trim().slice(0, 2000) : null, p_actor_id: staff.userId });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : error.code === "P0003" ? 422 : 500;
    return NextResponse.json({ error: status === 500 ? "สร้างเคสไม่สำเร็จ กรุณาลองใหม่" : status === 422 ? "นัดหรือ อสม. ไม่พร้อมรับงาน" : "ไม่พบนัดหรือไม่มีสิทธิ์สร้างเคส" }, { status });
  }
  const result = data as { id: string; existing: boolean; appointment_id: string };
  let delivery = null;
  if (!result.existing) { try { delivery = await dispatchNotifications({ appointmentId: result.appointment_id }); } catch { /* Queued notices remain retryable. */ } }
  return NextResponse.json({ ...result, delivery }, { status: result.existing ? 200 : 201 });
}
