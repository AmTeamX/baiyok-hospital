import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";

export const runtime = "nodejs";

type AddBody = {
  hn?: unknown;
  fullName?: unknown;
  phone?: unknown;
  village?: unknown;
  appointmentDate?: unknown;
  appointmentTime?: unknown;
  clinic?: unknown;
  status?: unknown;
};

export async function GET(request: Request) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  if (!hasSupabaseAdmin() || !staff.serviceUnitId) {
    return NextResponse.json({ ok: true, mode: "demo", patients: [], total: 0 });
  }

  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = createAdminClient();
  let query = supabase
    .from("patients")
    .select("id, hn, full_name, phone, village, birth_date", { count: "exact" })
    .eq("service_unit_id", staff.serviceUnitId);
  if (q) query = query.or(`hn.ilike.%${q}%,full_name.ilike.%${q}%,village.ilike.%${q}%`);

  const { data: patients, count, error } = await query.order("full_name", { ascending: true }).range(from, to);
  if (error) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });

  const patientIds = (patients ?? []).map((patient) => patient.id);
  const { data: appointments } = patientIds.length
    ? await supabase
        .from("appointments")
        .select("id, patient_id, appointment_at, clinic, status")
        .in("patient_id", patientIds)
        .order("appointment_at", { ascending: false })
    : { data: [] };

  const byPatient = new Map<string, Array<{ id: string; appointment_at: string; clinic: string; status: string }>>();
  for (const appointment of (appointments ?? []) as Array<{ id: string; patient_id: string; appointment_at: string; clinic: string; status: string }>) {
    const list = byPatient.get(appointment.patient_id) ?? [];
    list.push(appointment);
    byPatient.set(appointment.patient_id, list);
  }

  const rows = (patients ?? []).map((patient) => {
    const list = byPatient.get(patient.id) ?? [];
    const latest = list[0] ?? null;
    return {
      id: patient.id,
      hn: patient.hn,
      fullName: patient.full_name,
      phone: patient.phone ?? null,
      village: patient.village ?? null,
      birthDate: patient.birth_date ?? null,
      appointmentCount: list.length,
      latestAppointment: latest ? { appointmentAt: latest.appointment_at, clinic: latest.clinic, status: latest.status } : null
    };
  });

  return NextResponse.json({ ok: true, mode: "database", patients: rows, total: count ?? 0, page, pageSize });
}

export async function POST(request: Request) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as AddBody;
  const hn = typeof body.hn === "string" ? body.hn.trim() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  const village = typeof body.village === "string" && body.village.trim() ? body.village.trim() : null;
  const appointmentDate = typeof body.appointmentDate === "string" ? body.appointmentDate.trim() : "";
  const appointmentTime = (typeof body.appointmentTime === "string" ? body.appointmentTime.trim() : "") || "08:00";
  const clinic = typeof body.clinic === "string" ? body.clinic.trim() : "";
  const status = body.status === "missed" ? "missed" : "scheduled";

  if (!hn || !fullName || !clinic) {
    return NextResponse.json({ ok: false, error: "กรุณากรอก HN ชื่อ และคลินิก" }, { status: 422 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
    return NextResponse.json({ ok: false, error: "วันที่นัดไม่ถูกต้อง" }, { status: 422 });
  }
  if (!/^\d{2}:\d{2}$/.test(appointmentTime)) {
    return NextResponse.json({ ok: false, error: "เวลานัดไม่ถูกต้อง" }, { status: 422 });
  }
  const appointmentAt = `${appointmentDate}T${appointmentTime}:00+07:00`;
  if (Number.isNaN(Date.parse(appointmentAt))) {
    return NextResponse.json({ ok: false, error: "วันและเวลานัดไม่ถูกต้อง" }, { status: 422 });
  }

  if (!hasSupabaseAdmin() || !staff.userId || !staff.serviceUnitId) {
    if (!hasSupabaseAdmin() || !staff.userId) {
      return NextResponse.json({ ok: true, mode: "demo", patientId: "demo", appointmentId: "demo" });
    }
    return NextResponse.json({ ok: false, error: "service_unit_required" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .upsert(
      { hn, full_name: fullName, phone, village, service_unit_id: staff.serviceUnitId },
      { onConflict: "hn" }
    )
    .select("id")
    .single();
  if (patientError || !patient) {
    return NextResponse.json({ ok: false, error: "บันทึกผู้ป่วยไม่สำเร็จ" }, { status: 500 });
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .insert({
      patient_id: patient.id,
      appointment_at: appointmentAt,
      clinic,
      status,
      missed_marked_at: status === "missed" ? new Date().toISOString() : null,
      source_system: "manual"
    })
    .select("id")
    .single();
  if (appointmentError) {
    if (appointmentError.code === "23505") {
      return NextResponse.json({ ok: false, error: "ผู้ป่วยนี้มีนัดในวัน/คลินิกนี้อยู่แล้ว" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: "บันทึกนัดไม่สำเร็จ" }, { status: 500 });
  }

  if (status === "missed") {
    const { error: followUpError } = await supabase
      .from("follow_ups")
      .insert({ appointment_id: appointment.id, status: "pending", priority: "normal" });
    if (followUpError) {
      return NextResponse.json({ ok: false, error: "สร้างรายการติดตามไม่สำเร็จ" }, { status: 500 });
    }
  }

  await supabase.from("audit_logs").insert({
    actor_id: staff.userId,
    actor_role: "nurse",
    service_unit_id: staff.serviceUnitId,
    action: "patient_appointment_added",
    entity_type: "appointment",
    entity_id: appointment.id,
    after_data: { hn, clinic, appointment_at: appointmentAt, status }
  });

  return NextResponse.json({ ok: true, mode: "database", patientId: patient.id, appointmentId: appointment.id, status });
}
