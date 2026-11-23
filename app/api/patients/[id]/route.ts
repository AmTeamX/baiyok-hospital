import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!hasSupabaseAdmin() || !staff.serviceUnitId) {
    return NextResponse.json({ ok: false, error: "database_required" }, { status: 503 });
  }

  const supabase = createAdminClient();
  const { data: patient, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .eq("service_unit_id", staff.serviceUnitId)
    .single();
  if (error || !patient) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, appointment_at, clinic, status, attended_at, missed_marked_at")
    .eq("patient_id", id)
    .order("appointment_at", { ascending: false });

  const appointmentIds = (appointments ?? []).map((appointment) => appointment.id);
  const [{ data: followUps }, { data: links }] = await Promise.all([
    appointmentIds.length
      ? supabase.from("follow_ups").select("id, appointment_id, status, priority, missed_reason, assigned_volunteer_id").in("appointment_id", appointmentIds)
      : Promise.resolve({ data: [] }),
    supabase.from("line_account_links").select("id, status, line_account_id, line_accounts(line_user_id, display_name)").eq("patient_id", id).eq("role", "patient")
  ]);

  const volunteerIds = [...new Set([...(followUps ?? []).map((fu) => fu.assigned_volunteer_id), patient.assigned_volunteer_id].filter(Boolean))] as string[];
  const { data: volunteers } = volunteerIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", volunteerIds)
    : { data: [] };
  const volunteerNameMap = new Map((volunteers ?? []).map((volunteer) => [volunteer.id, volunteer.full_name]));

  const followUpMap = new Map<string, Record<string, unknown>>((followUps ?? []).map((fu) => [fu.appointment_id, fu]));
  const activeLink = (links ?? []).find((link) => link.status === "active");

  const appointmentsRows = (appointments ?? []).map((appointment) => {
    const followUp = followUpMap.get(appointment.id);
    return {
      id: appointment.id,
      appointmentAt: appointment.appointment_at,
      clinic: appointment.clinic,
      status: appointment.status,
      attendedAt: appointment.attended_at,
      missedMarkedAt: appointment.missed_marked_at,
      followUp: followUp
        ? {
            id: followUp.id,
            status: followUp.status,
            priority: followUp.priority,
            missedReason: followUp.missed_reason,
            assigneeName: typeof followUp.assigned_volunteer_id === "string" ? volunteerNameMap.get(followUp.assigned_volunteer_id) ?? null : null
          }
        : null
    };
  });

  const account = Array.isArray(activeLink?.line_accounts) ? activeLink?.line_accounts[0] : activeLink?.line_accounts;

  return NextResponse.json({
    ok: true,
    mode: "database",
    patient: {
      id: patient.id,
      hn: patient.hn,
      fullName: patient.full_name,
      phone: patient.phone,
      village: patient.village,
      birthDate: patient.birth_date,
      contactPreference: patient.contact_preference,
      assignedVolunteerId: patient.assigned_volunteer_id ?? null,
      assigneeName: typeof patient.assigned_volunteer_id === "string" ? volunteerNameMap.get(patient.assigned_volunteer_id) ?? null : null
    },
    line: {
      linked: Boolean(activeLink),
      displayName: account?.display_name ?? null
    },
    appointments: appointmentsRows
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    fullName?: unknown;
    phone?: unknown;
    village?: unknown;
    birthDate?: unknown;
    contactPreference?: unknown;
  };
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
  const village = typeof body.village === "string" ? body.village.trim() || null : null;
  const birthDate = typeof body.birthDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.birthDate) ? body.birthDate : null;
  const contactPreference = ["line", "phone", "both", "none"].includes(String(body.contactPreference)) ? String(body.contactPreference) : "line";

  if (!fullName) return NextResponse.json({ ok: false, error: "ชื่อต้องไม่ว่าง" }, { status: 422 });

  if (!hasSupabaseAdmin() || !staff.serviceUnitId) {
    return NextResponse.json({ ok: true, mode: "demo" });
  }

  const supabase = createAdminClient();
  const { data: existing, error: readError } = await supabase
    .from("patients")
    .select("id")
    .eq("id", id)
    .eq("service_unit_id", staff.serviceUnitId)
    .single();
  if (readError || !existing) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const { error } = await supabase
    .from("patients")
    .update({ full_name: fullName, phone, village, birth_date: birthDate, contact_preference: contactPreference })
    .eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: "บันทึกไม่สำเร็จ" }, { status: 500 });

  return NextResponse.json({ ok: true, mode: "database" });
}
