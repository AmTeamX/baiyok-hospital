import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";
import { isValidQueueBookingStatus } from "@/lib/queue";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { status?: unknown; reason?: unknown };
  if (!isValidQueueBookingStatus(body.status) || !["checked_in", "no_show", "cancelled"].includes(body.status)) {
    return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 422 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : null;
  if (!reason) {
    return NextResponse.json({ ok: false, error: "reason_required" }, { status: 422 });
  }

  if (!hasSupabaseAdmin() || !staff.userId) {
    return NextResponse.json({ ok: true, mode: "demo", booking_id: id, status: body.status });
  }

  const { data, error } = await createAdminClient().rpc("override_booking", {
    p_booking_id: id,
    p_status: body.status,
    p_reason: reason,
    p_actor_id: staff.userId
  });

  if (error) {
    if (typeof error.code === "string" && error.code === "P0002") {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: "อัปเดตคิวไม่สำเร็จ" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mode: "database", ...(data as Record<string, unknown>) });
}
