import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const errorMessages: Record<string, { status: number; error: string }> = {
  P0002: { status: 404, error: "ไม่พบรายการติดตาม" },
  P0003: { status: 422, error: "อสม. ไม่มีสิทธิ์รับงาน (ไม่ active หรืออยู่ต่างหน่วยบริการ)" },
  "42501": { status: 403, error: "ไม่มีสิทธิ์ดำเนินการ" }
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบรายการติดตาม" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const volunteerId = typeof body?.volunteer_id === "string" ? body.volunteer_id : "";
  if (!uuidPattern.test(volunteerId)) return NextResponse.json({ ok: false, error: "ต้องระบุ อสม. ที่จะมอบหมาย" }, { status: 422 });

  if (!hasSupabaseAdmin() || !staff.userId) {
    return NextResponse.json({ ok: true, mode: "demo", follow_up_id: id, volunteer_id: volunteerId, notification_status: "pending" });
  }

  const { data, error } = await createAdminClient().rpc("assign_follow_up", {
    p_follow_up_id: id,
    p_volunteer_id: volunteerId,
    p_actor_id: staff.userId
  });

  if (error) {
    const code = typeof error.code === "string" ? error.code : "";
    const mapped = errorMessages[code];
    if (mapped) return NextResponse.json({ ok: false, error: mapped.error }, { status: mapped.status });
    return NextResponse.json({ ok: false, error: "มอบหมายไม่สำเร็จ" }, { status: 500 });
  }

  const result = data as { follow_up_id: string; volunteer_id: string; reassigned: boolean; idempotent: boolean; notification_id: string | null; notification_status: string };
  return NextResponse.json({ ok: true, mode: "database", ...result });
}
