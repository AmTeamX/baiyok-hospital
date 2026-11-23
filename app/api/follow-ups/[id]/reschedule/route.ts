import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const errorMessages: Record<string, { status: number; error: string }> = {
  P0002: { status: 404, error: "ไม่พบรายการติดตาม" },
  "42501": { status: 403, error: "ไม่มีสิทธิ์ดำเนินการ" }
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบรายการติดตาม" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const appointmentAt = typeof body?.appointment_at === "string" && !Number.isNaN(Date.parse(body.appointment_at))
    ? new Date(body.appointment_at).toISOString()
    : null;
  if (!appointmentAt) return NextResponse.json({ ok: false, error: "ต้องระบุวันและเวลานัดใหม่" }, { status: 422 });

  const priority = typeof body?.priority === "string" ? body.priority : "normal";

  if (!hasSupabaseAdmin() || !staff.userId) {
    return NextResponse.json({ ok: true, mode: "demo", follow_up_id: id, new_appointment_id: null, priority });
  }

  const { data, error } = await createAdminClient().rpc("reschedule_follow_up", {
    p_follow_up_id: id,
    p_appointment_at: appointmentAt,
    p_priority: priority,
    p_actor_id: staff.userId
  });

  if (error) {
    const mapped = errorMessages[typeof error.code === "string" ? error.code : ""];
    if (mapped) return NextResponse.json({ ok: false, error: mapped.error }, { status: mapped.status });
    return NextResponse.json({ ok: false, error: "บันทึกนัดใหม่ไม่สำเร็จ" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mode: "database", ...(data as Record<string, unknown>) });
}
