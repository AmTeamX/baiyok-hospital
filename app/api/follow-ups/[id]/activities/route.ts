import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const errorMessages: Record<string, { status: number; error: string }> = {
  P0002: { status: 404, error: "not_found" },
  "42501": { status: 403, error: "forbidden" }
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as { activityType?: string; note?: string };
  const activityType = (body.activityType ?? "").trim().slice(0, 120);
  if (!activityType) return NextResponse.json({ ok: false, error: "activity_type_required" }, { status: 422 });

  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ ok: true, mode: "demo", activity: { id: `demo-${Date.now()}`, activityType, note: body.note ?? null, performedAt: new Date().toISOString() } });
  }

  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!staff.userId) return NextResponse.json({ ok: false, error: "service_unit_required" }, { status: 403 });

  const { data, error } = await createAdminClient().rpc("add_follow_up_activity", {
    p_follow_up_id: id,
    p_activity_type: activityType,
    p_note: body.note?.trim() || null,
    p_actor_id: staff.userId
  });

  if (error) {
    const mapped = errorMessages[typeof error.code === "string" ? error.code : ""];
    if (mapped) return NextResponse.json({ ok: false, error: mapped.error }, { status: mapped.status });
    return NextResponse.json({ ok: false, error: "เพิ่มกิจกรรมไม่สำเร็จ" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mode: "database", ...(data as Record<string, unknown>) });
}
