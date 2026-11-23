import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await request.json();
  if (!body.reason) return NextResponse.json({ ok: false, error: "กรุณาเลือกเหตุผลที่ขาดนัด" }, { status: 422 });
  const appointmentId = String(body.appointment_id ?? "");
  if (hasSupabaseAdmin() && uuidPattern.test(appointmentId)) {
    const supabase = createAdminClient();
    const { data: appointment, error: appointmentError } = await supabase.from("appointments").select("patient_id, clinic").eq("id", appointmentId).single();
    if (appointmentError) return NextResponse.json({ ok: false, error: "ไม่พบรายการนัด" }, { status: 404 });

    let newAppointmentId: string | null = null;
    if (body.new_appointment_date) {
      const appointmentAt = `${body.new_appointment_date}T${body.new_appointment_time || "08:00"}:00+07:00`;
      const { data: nextAppointment, error } = await supabase.from("appointments").upsert({ patient_id: appointment.patient_id, clinic: appointment.clinic, appointment_at: appointmentAt, status: "scheduled" }, { onConflict: "patient_id,appointment_at,clinic" }).select("id").single();
      if (error) throw error; newAppointmentId = nextAppointment.id;
    }

    let volunteerId: string | null = null;
    if (body.volunteer) {
      const { data: volunteer } = await supabase.from("profiles").select("id").eq("full_name", body.volunteer).eq("role", "volunteer").maybeSingle();
      volunteerId = volunteer?.id ?? null;
    }
    const returned = body.returned === "yes";
    const { data: followUp, error: followUpError } = await supabase.from("follow_ups").upsert({
      appointment_id: appointmentId,
      missed_reason: body.reason,
      reason_note: body.reason_note || null,
      counselling_note: body.counselling_note || null,
      assigned_volunteer_id: volunteerId,
      new_appointment_id: newAppointmentId,
      status: returned ? "returned" : newAppointmentId ? "rescheduled" : volunteerId ? "assigned" : "contacted",
      returned_confirmed_at: returned ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
      created_by: staff.userId
    }, { onConflict: "appointment_id" }).select("id").single();
    if (followUpError) throw followUpError;

    const activities = Object.entries(body).filter(([key, value]) => key.startsWith("activity_") && value === "yes").map(([key]) => ({ follow_up_id: followUp.id, activity_type: key.replace("activity_", "") }));
    if (activities.length) { const { error } = await supabase.from("follow_up_activities").insert(activities); if (error) throw error; }
  }
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString(), mode: hasSupabaseAdmin() ? "database" : "demo" });
}
