import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";
import {
  PATIENT_REQUEST_STATUS_LABELS,
  PATIENT_REQUEST_TYPE_LABELS,
  PATIENT_REQUEST_REASON_LABELS
} from "@/lib/patient";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const status = new URL(request.url).searchParams.get("status") ?? null;

  if (!hasSupabaseAdmin() || !staff.serviceUnitId) {
    return NextResponse.json({ ok: true, mode: "demo", requests: [] });
  }

  const { data, error } = await createAdminClient().rpc("search_patient_requests", {
    p_service_unit_id: staff.serviceUnitId,
    p_status: status
  });
  if (error) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });

  const payload = data as { rows?: Record<string, unknown>[] } | null;
  const requests = (payload?.rows ?? []).map((row) => ({
    id: String(row.id),
    requestType: String(row.request_type),
    typeLabel: PATIENT_REQUEST_TYPE_LABELS[row.request_type as keyof typeof PATIENT_REQUEST_TYPE_LABELS] ?? String(row.request_type),
    reasonCode: String(row.reason_code),
    reasonLabel: PATIENT_REQUEST_REASON_LABELS[String(row.reason_code)] ?? String(row.reason_code),
    note: row.note ?? null,
    status: String(row.status),
    statusLabel: PATIENT_REQUEST_STATUS_LABELS[row.status as keyof typeof PATIENT_REQUEST_STATUS_LABELS] ?? String(row.status),
    assignedTo: row.assigned_to ?? null,
    assigneeName: row.assignee_name ?? null,
    appointmentId: row.appointment_id ?? null,
    appointmentAt: row.appointment_at ?? null,
    appointmentClinic: row.appointment_clinic ?? null,
    patientId: row.patient_id ?? null,
    staffResponse: row.staff_response ?? null,
    patientName: row.patient_name ?? null,
    createdAt: row.created_at ?? null,
    acknowledgedAt: row.acknowledged_at ?? null,
    resolvedAt: row.resolved_at ?? null
  }));

  return NextResponse.json({ ok: true, mode: "database", requests });
}
