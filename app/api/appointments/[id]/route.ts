import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";
import { dispatchNotifications } from "@/lib/notification-dispatch";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => ({})) as {
    appointmentAt?: unknown;
    clinic?: unknown;
    status?: unknown;
  };
  const clinic = typeof body.clinic === "string" ? body.clinic.trim() : "";
  const status = body.status === "cancelled" ? "cancelled" : "scheduled";

  let appointmentAt: string | null = null;
  if (typeof body.appointmentAt === "string" && body.appointmentAt.trim()) {
    const date = new Date(body.appointmentAt);
    if (!Number.isNaN(date.getTime())) appointmentAt = date.toISOString();
  }
  if (status === "scheduled" && (!appointmentAt || !clinic)) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกวัน เวลา และคลินิกให้ถูกต้อง" }, { status: 422 });
  }

  if (!hasSupabaseAdmin() || !staff.serviceUnitId) {
    return NextResponse.json({ ok: true, mode: "demo", appointmentId: id, status, appointmentAt, clinic });
  }

  const supabase = createAdminClient();
  const { data: appointment, error: readError } = await supabase
    .from("appointments")
    .select("id, patient_id")
    .eq("id", id)
    .maybeSingle();
  if (readError || !appointment) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id")
    .eq("id", appointment.patient_id)
    .eq("service_unit_id", staff.serviceUnitId)
    .maybeSingle();
  if (patientError || !patient) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const update: Record<string, unknown> = { status };
  if (status === "scheduled") {
    update.appointment_at = appointmentAt;
    update.clinic = clinic;
  }

  const { error } = await supabase
    .from("appointments")
    .update(update)
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return NextResponse.json({ ok: false, error: "ผู้ป่วยมีนัดในวัน เวลา และคลินิกนี้อยู่แล้ว" }, { status: 409 });
    return NextResponse.json({ ok: false, error: "บันทึกนัดไม่สำเร็จ" }, { status: 500 });
  }

  const { data: link } = await supabase
    .from("line_account_links")
    .select("line_account_id")
    .eq("patient_id", appointment.patient_id)
    .eq("role", "patient")
    .eq("status", "active")
    .maybeSingle();
  if (link?.line_account_id) {
    const notificationStatus = status === "cancelled" ? "cancelled" : "rescheduled";
    await supabase.from("notification_logs").insert({
      appointment_id: id,
      recipient_line_account_id: link.line_account_id,
      kind: notificationStatus === "cancelled" ? "appointment_cancelled" : "appointment_rescheduled",
      channel: "line",
      status: "pending",
      idempotency_key: `${notificationStatus}:${id}:${appointmentAt ?? "cancelled"}`,
      attempt_count: 0,
      next_attempt_at: new Date().toISOString()
    });
  }

  try {
    await dispatchNotifications({ appointmentId: id });
  } catch {
    // The notification remains pending in the outbox and will be retried by the cron job.
  }

  return NextResponse.json({ ok: true, mode: "database", appointmentId: id, status, appointmentAt, clinic });
}
