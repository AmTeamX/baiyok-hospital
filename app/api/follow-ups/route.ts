import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";
import { isValidMissedReason, normalizePriority } from "@/lib/follow-ups";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!isValidMissedReason(reason)) return NextResponse.json({ ok: false, error: "กรุณาเลือกเหตุผลที่ขาดนัด" }, { status: 422 });

  const appointmentId = String(body.appointment_id ?? "");
  const priority = normalizePriority(body.priority);

  if (!hasSupabaseAdmin() || !staff.userId || !staff.serviceUnitId) {
    return NextResponse.json({ ok: true, savedAt: new Date().toISOString(), mode: "demo" });
  }

  const supabase = createAdminClient();
  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, patient_id, clinic, patient:patients!inner(service_unit_id)")
    .eq("id", appointmentId)
    .single();
  if (appointmentError) return NextResponse.json({ ok: false, error: "ไม่พบรายการนัด" }, { status: 404 });

  const patient = Array.isArray(appointment.patient) ? appointment.patient[0] : appointment.patient;
  if (patient?.service_unit_id !== staff.serviceUnitId) return NextResponse.json({ ok: false, error: "ไม่มีสิทธิ์ดำเนินการ" }, { status: 403 });

  let newAppointmentId: string | null = null;
  if (body.new_appointment_date) {
    const appointmentAt = `${body.new_appointment_date}T${body.new_appointment_time || "08:00"}:00+07:00`;
    const { data: nextAppointment, error } = await supabase
      .from("appointments")
      .upsert({ patient_id: appointment.patient_id, clinic: appointment.clinic, appointment_at: appointmentAt, status: "scheduled", source_system: "manual" }, { onConflict: "patient_id,appointment_at,clinic" })
      .select("id")
      .single();
    if (error) throw error;
    newAppointmentId = nextAppointment.id;
    await supabase.from("appointments").update({ status: "rescheduled", superseded_by_appointment_id: newAppointmentId }).eq("id", appointmentId);
  }

  let volunteerId: string | null = null;
  if (typeof body.volunteer_id === "string" && uuidPattern.test(body.volunteer_id)) {
    const { data: volunteer } = await supabase
      .from("profiles")
      .select("id, active, service_unit_id")
      .eq("id", body.volunteer_id)
      .eq("role", "volunteer")
      .maybeSingle();
    if (!volunteer) return NextResponse.json({ ok: false, error: "ไม่พบ อสม." }, { status: 422 });
    if (!volunteer.active || volunteer.service_unit_id !== staff.serviceUnitId) {
      return NextResponse.json({ ok: false, error: "อสม. ไม่ active หรืออยู่ต่างหน่วยบริการ" }, { status: 422 });
    }
    volunteerId = volunteer.id;
  }

  const returned = body.returned === "yes";
  const { data: followUp, error: followUpError } = await supabase
    .from("follow_ups")
    .upsert({
      appointment_id: appointmentId,
      missed_reason: reason,
      reason_note: body.reason_note || null,
      counselling_note: body.counselling_note || null,
      assigned_volunteer_id: volunteerId,
      new_appointment_id: newAppointmentId,
      priority,
      status: returned ? "returned" : newAppointmentId ? "rescheduled" : volunteerId ? "assigned" : "contacted",
      returned_confirmed_at: returned ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
      created_by: staff.userId
    }, { onConflict: "appointment_id" })
    .select("id")
    .single();
  if (followUpError) throw followUpError;

  const activities = Object.entries(body)
    .filter(([key, value]) => key.startsWith("activity_") && value === "yes")
    .map(([key]) => ({ follow_up_id: followUp.id, activity_type: key.replace("activity_", ""), performed_by: staff.userId }));
  if (activities.length) {
    const { error } = await supabase.from("follow_up_activities").insert(activities);
    if (error) throw error;
  }

  await supabase.from("audit_logs").insert({
    actor_id: staff.userId,
    actor_role: "nurse",
    service_unit_id: staff.serviceUnitId,
    action: "follow_up_assessed",
    entity_type: "follow_up",
    entity_id: followUp.id,
    after_data: { status: returned ? "returned" : newAppointmentId ? "rescheduled" : volunteerId ? "assigned" : "contacted", priority }
  });

  return NextResponse.json({ ok: true, savedAt: new Date().toISOString(), mode: "database" });
}
