import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";
import { isValidPatientRequestStatus } from "@/lib/patient";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const rpcErrors: Record<string, { status: number; error: string }> = {
  P0002: { status: 404, error: "not_found" },
  "42501": { status: 403, error: "forbidden" }
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { status?: unknown; assignedTo?: unknown };
  if (!isValidPatientRequestStatus(body.status)) {
    return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 422 });
  }
  const assignedTo = typeof body.assignedTo === "string" && uuidPattern.test(body.assignedTo) ? body.assignedTo : null;

  if (!hasSupabaseAdmin() || !staff.userId) {
    return NextResponse.json({ ok: true, mode: "demo", request_id: id, status: body.status });
  }

  const { data, error } = await createAdminClient().rpc("transition_patient_request", {
    p_request_id: id,
    p_actor_id: staff.userId,
    p_status: body.status,
    p_assigned_to: assignedTo
  });

  if (error) {
    const mapped = rpcErrors[typeof error.code === "string" ? error.code : ""];
    if (mapped) return NextResponse.json({ ok: false, error: mapped.error }, { status: mapped.status });
    return NextResponse.json({ ok: false, error: "อัปเดตคำขอไม่สำเร็จ" }, { status: 500 });
  }

  const result = data as Record<string, unknown>;
  const status = String(result.status ?? body.status);

  const supabase = createAdminClient();
  const { data: requestRow } = await supabase
    .from("patient_requests")
    .select("id, patient_id, appointment_id")
    .eq("id", id)
    .maybeSingle();
  if (requestRow) {
    const { data: link } = await supabase
      .from("line_account_links")
      .select("line_account_id")
      .eq("patient_id", requestRow.patient_id)
      .eq("role", "patient")
      .eq("status", "active")
      .maybeSingle();
    if (link?.line_account_id) {
      await supabase.from("notification_logs").insert({
        appointment_id: requestRow.appointment_id ?? null,
        patient_request_id: id,
        recipient_line_account_id: link.line_account_id,
        kind: "patient_request_status",
        channel: "line",
        status: "pending",
        idempotency_key: `patient_request_status:${id}:${status}`,
        attempt_count: 0,
        next_attempt_at: new Date().toISOString()
      });
    }
  }

  return NextResponse.json({ ok: true, mode: "database", ...result });
}
