import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePatient, patientAuthStatus } from "@/lib/line/patient-auth";
import {
  isValidPatientRequestReason,
  isValidPatientRequestType,
  PATIENT_REQUEST_STATUS_LABELS,
  PATIENT_REQUEST_TYPE_LABELS,
  PATIENT_REQUEST_REASON_LABELS,
  type PatientRequestType
} from "@/lib/patient";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const result = await requirePatient();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: patientAuthStatus(result.reason) });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("patient_requests")
    .select("id, appointment_id, request_type, reason_code, note, status, created_at, resolved_at")
    .eq("patient_id", result.identity.patientId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });

  const requests = (data ?? []).map((item) => ({
    id: item.id,
    requestType: item.request_type,
    typeLabel: PATIENT_REQUEST_TYPE_LABELS[item.request_type as PatientRequestType] ?? item.request_type,
    reasonCode: item.reason_code,
    reasonLabel: PATIENT_REQUEST_REASON_LABELS[item.reason_code] ?? item.reason_code,
    note: item.note,
    appointmentId: item.appointment_id,
    status: item.status,
    statusLabel: PATIENT_REQUEST_STATUS_LABELS[item.status as keyof typeof PATIENT_REQUEST_STATUS_LABELS] ?? item.status,
    createdAt: item.created_at,
    resolvedAt: item.resolved_at
  }));

  return NextResponse.json({ ok: true, requests });
}

export async function POST(request: Request) {
  const result = await requirePatient();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: patientAuthStatus(result.reason) });
  }

  const body = (await request.json().catch(() => ({}))) as {
    requestType?: unknown;
    reasonCode?: unknown;
    note?: unknown;
    appointmentId?: unknown;
  };
  if (!isValidPatientRequestType(body.requestType)) {
    return NextResponse.json({ ok: false, error: "invalid_request_type" }, { status: 422 });
  }
  const type = body.requestType as PatientRequestType;
  if (!isValidPatientRequestReason(type, body.reasonCode)) {
    return NextResponse.json({ ok: false, error: "invalid_reason" }, { status: 422 });
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;
  const appointmentId = typeof body.appointmentId === "string" && uuidPattern.test(body.appointmentId) ? body.appointmentId : null;

  const supabase = createAdminClient();
  let recipientLineAccountId: string | null = null;
  const { data: activeLink } = await supabase
    .from("line_account_links")
    .select("line_account_id")
    .eq("patient_id", result.identity.patientId)
    .eq("role", "patient")
    .eq("status", "active")
    .maybeSingle();
  if (activeLink?.line_account_id) recipientLineAccountId = activeLink.line_account_id;

  if (appointmentId) {
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id")
      .eq("id", appointmentId)
      .eq("patient_id", result.identity.patientId)
      .maybeSingle();
    if (appointmentError) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });
    if (!appointment) return NextResponse.json({ ok: false, error: "invalid_appointment" }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("patient_requests")
    .insert({
      patient_id: result.identity.patientId,
      request_type: type,
      reason_code: body.reasonCode as string,
      note,
      appointment_id: appointmentId
    })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });

  await supabase.from("audit_logs").insert({
    actor_role: null,
    action: "patient_request_created",
    entity_type: "patient_request",
    entity_id: data.id,
    after_data: { request_type: type, reason_code: body.reasonCode }
  });

  if (recipientLineAccountId) {
    await supabase.from("notification_logs").insert({
      appointment_id: appointmentId,
      patient_request_id: data.id,
      recipient_line_account_id: recipientLineAccountId,
      kind: "patient_request_status",
      channel: "line",
      status: "pending",
      idempotency_key: `patient_request_status:${data.id}:new`,
      attempt_count: 0,
      next_attempt_at: new Date().toISOString()
    });
  }

  return NextResponse.json({ ok: true, id: data.id, status: "new" });
}
