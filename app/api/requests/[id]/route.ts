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

  return NextResponse.json({ ok: true, mode: "database", ...(data as Record<string, unknown>) });
}
