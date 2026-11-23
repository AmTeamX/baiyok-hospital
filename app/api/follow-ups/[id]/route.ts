import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";
import { ageFromBirthDate, demoFollowUpDetail, type FollowUpDetail } from "@/lib/follow-up";
import { MISSED_PRIORITIES, MISSED_STATUSES } from "@/lib/missed";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AppointmentWithPatient = {
  id: string;
  appointment_at: string;
  clinic: string;
  status: string;
  missed_marked_at: string | null;
  patient_id: string;
  patients: { id: string; hn: string; full_name: string; birth_date: string | null; village: string | null; phone: string | null; service_unit_id: string | null } | Array<{ id: string; hn: string; full_name: string; birth_date: string | null; village: string | null; phone: string | null; service_unit_id: string | null }>;
};

async function getFollowUpDetail(supabase: ReturnType<typeof createAdminClient>, id: string, serviceUnitId: string): Promise<FollowUpDetail | null> {
  const initial = await supabase.from("follow_ups").select("*").eq("id", id).maybeSingle();
  if (initial.error) throw new Error("case_read_failed");
  let followUp = initial.data;
  if (!followUp) {
    const fallback = await supabase.from("follow_ups").select("*").eq("appointment_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (fallback.error) throw new Error("case_read_failed");
    followUp = fallback.data;
  }
  if (!followUp) return null;

  const [{ data: appointment, error: appointmentError }, { data: activities, error: activitiesError }, { data: assignee }] = await Promise.all([
    supabase.from("appointments").select("id, appointment_at, clinic, status, missed_marked_at, patient_id, patients(id, hn, full_name, birth_date, village, phone, service_unit_id)").eq("id", followUp.appointment_id).single(),
    supabase.from("follow_up_activities").select("id, activity_type, note, performed_by, performed_at").eq("follow_up_id", followUp.id).order("performed_at", { ascending: true }),
    followUp.assigned_volunteer_id ? supabase.from("profiles").select("id, full_name").eq("id", followUp.assigned_volunteer_id).maybeSingle() : Promise.resolve({ data: null })
  ]);
  if (appointmentError || activitiesError) throw new Error("case_read_failed");

  const relatedPatient = (appointment as AppointmentWithPatient | null)?.patients;
  const patient = Array.isArray(relatedPatient) ? relatedPatient[0] ?? null : relatedPatient ?? null;
  if (patient?.service_unit_id !== serviceUnitId) return null;

  const { data: links } = await supabase
    .from("line_account_links")
    .select("status, line_account_id, line_accounts(display_name)")
    .eq("patient_id", patient.id)
    .eq("role", "patient");
  const activeLink = (links ?? []).find((link) => link.status === "active");
  const account = Array.isArray(activeLink?.line_accounts)
    ? activeLink.line_accounts[0]
    : activeLink?.line_accounts;

  const performerIds = [...new Set((activities ?? []).map((activity) => activity.performed_by).filter((value): value is string => Boolean(value)))];
  const { data: performers } = performerIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", performerIds)
    : { data: [] };
  const performerMap = new Map((performers ?? []).map((profile) => [profile.id, profile.full_name]));

  return {
    id: followUp.id,
    appointmentId: followUp.appointment_id,
    status: followUp.status,
    missedReason: followUp.missed_reason,
    reasonNote: followUp.reason_note,
    counsellingNote: followUp.counselling_note,
    priority: followUp.priority,
    assignedVolunteerId: followUp.assigned_volunteer_id,
    assigneeName: assignee?.full_name ?? null,
    version: followUp.version,
    createdAt: followUp.created_at,
    updatedAt: followUp.updated_at,
    closureReason: followUp.closure_reason,
    assignedAt: followUp.assigned_at,
    contactedAt: followUp.contacted_at,
    closedAt: followUp.closed_at,
    returnedConfirmedAt: followUp.returned_confirmed_at,
    newAppointmentId: followUp.new_appointment_id,
    appointment: {
      id: appointment?.id ?? followUp.appointment_id,
      appointmentAt: appointment?.appointment_at ?? "",
      clinic: appointment?.clinic ?? "",
      status: appointment?.status ?? "",
      missedMarkedAt: appointment?.missed_marked_at ?? null
    },
    patient: {
      id: patient?.id ?? "",
      hn: patient?.hn ?? "",
      fullName: patient?.full_name ?? "",
      birthDate: patient?.birth_date ?? null,
      age: ageFromBirthDate(patient?.birth_date ?? null),
      village: patient?.village ?? null,
      phone: patient?.phone ?? null
    },
    line: {
      linked: Boolean(activeLink),
      displayName: account?.display_name ?? null
    },
    activities: (activities ?? []).map((activity) => ({
      id: activity.id,
      activityType: activity.activity_type,
      note: activity.note,
      performedBy: activity.performed_by,
      performerName: activity.performed_by ? performerMap.get(activity.performed_by) ?? null : null,
      performedAt: activity.performed_at
    }))
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  if (!hasSupabaseAdmin()) {
    const detail = demoFollowUpDetail(id);
    if (!detail) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, mode: "demo", followUp: detail });
  }

  if (!staff.serviceUnitId) return NextResponse.json({ ok: false, error: "service_unit_required" }, { status: 403 });
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  try {
    const db = createAdminClient();
    const detail = await getFollowUpDetail(db, id, staff.serviceUnitId);
    if (detail) return NextResponse.json({ ok: true, mode: "database", followUp: detail });
    // Older registry links used appointment IDs even when no case existed.
    const { data: appointment, error } = await db.from("appointments").select("id, patient_id, patients!inner(service_unit_id)").eq("id", id).eq("patients.service_unit_id", staff.serviceUnitId).maybeSingle();
    if (error) throw new Error("appointment_read_failed");
    if (appointment) return NextResponse.json({ ok: false, error: "case_required", appointmentId: appointment.id, patientId: appointment.patient_id }, { status: 409 });
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  } catch {
    return NextResponse.json({ ok: false, error: "โหลดข้อมูลเคสไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}

const patchErrors: Record<string, { status: number; error: string }> = {
  P0002: { status: 404, error: "not_found" },
  P0004: { status: 409, error: "conflict" },
  "42501": { status: 403, error: "forbidden" }
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const version = Number(body.version);
  if (!Number.isInteger(version) || version < 1) {
    return NextResponse.json({ ok: false, error: "version_required" }, { status: 422 });
  }
  const status = typeof body.status === "string" ? body.status : null;
  const priority = typeof body.priority === "string" ? body.priority : null;
  if (status && !MISSED_STATUSES.includes(status as (typeof MISSED_STATUSES)[number])) {
    return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 422 });
  }
  if (priority && !MISSED_PRIORITIES.includes(priority as (typeof MISSED_PRIORITIES)[number])) {
    return NextResponse.json({ ok: false, error: "invalid_priority" }, { status: 422 });
  }

  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ ok: true, mode: "demo", version: version + 1 });
  }

  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!staff.userId) return NextResponse.json({ ok: false, error: "service_unit_required" }, { status: 403 });

  const { data, error } = await createAdminClient().rpc("update_follow_up", {
    p_follow_up_id: id,
    p_expected_version: version,
    p_actor_id: staff.userId,
    p_status: status,
    p_priority: priority,
    p_missed_reason: typeof body.missedReason === "string" ? body.missedReason || null : null,
    p_reason_note: typeof body.reasonNote === "string" ? body.reasonNote || null : null,
    p_counselling_note: typeof body.counsellingNote === "string" ? body.counsellingNote || null : null,
    p_closure_reason: typeof body.closureReason === "string" ? body.closureReason || null : null
  });

  if (error) {
    const mapped = patchErrors[typeof error.code === "string" ? error.code : ""];
    if (mapped) return NextResponse.json({ ok: false, error: mapped.error }, { status: mapped.status });
    return NextResponse.json({ ok: false, error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }

  const result = data as { version?: number };
  return NextResponse.json({ ok: true, mode: "database", version: result.version ?? version + 1 });
}
