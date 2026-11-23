import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    appointmentDate?: unknown;
    appointmentTime?: unknown;
    clinic?: unknown;
    status?: unknown;
  };
  const appointmentDate = typeof body.appointmentDate === "string" ? body.appointmentDate.trim() : "";
  const appointmentTime = (typeof body.appointmentTime === "string" ? body.appointmentTime.trim() : "") || "08:00";
  const clinic = typeof body.clinic === "string" ? body.clinic.trim() : "";
  const status = body.status === "missed" ? "missed" : "scheduled";

  if (!clinic || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกคลินิกและวันที่นัดให้ถูกต้อง" }, { status: 422 });
  }
  if (!/^\d{2}:\d{2}$/.test(appointmentTime)) {
    return NextResponse.json({ ok: false, error: "เวลานัดไม่ถูกต้อง" }, { status: 422 });
  }
  const appointmentAt = `${appointmentDate}T${appointmentTime}:00+07:00`;
  if (Number.isNaN(Date.parse(appointmentAt))) {
    return NextResponse.json({ ok: false, error: "วันและเวลานัดไม่ถูกต้อง" }, { status: 422 });
  }

  if (!hasSupabaseAdmin() || !staff.serviceUnitId) {
    return NextResponse.json({ ok: true, mode: "demo", appointmentId: "demo" });
  }

  const supabase = createAdminClient();
  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id")
    .eq("id", id)
    .eq("service_unit_id", staff.serviceUnitId)
    .single();
  if (patientError || !patient) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .insert({
      patient_id: id,
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

  return NextResponse.json({ ok: true, mode: "database", appointmentId: appointment.id, status });
}
