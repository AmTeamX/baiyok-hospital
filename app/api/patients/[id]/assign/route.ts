import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";
import { dispatchNotifications } from "@/lib/notification-dispatch";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const rpcErrors: Record<string, { status: number; error: string }> = {
  P0003: { status: 422, error: "อสม. ไม่ active หรืออยู่ต่างหน่วยบริการ" },
  "42501": { status: 403, error: "forbidden" }
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { volunteerId?: unknown };
  const volunteerId = typeof body.volunteerId === "string" ? body.volunteerId : "";
  if (!uuidPattern.test(volunteerId)) {
    return NextResponse.json({ ok: false, error: "ต้องระบุ อสม. ที่จะมอบหมาย" }, { status: 422 });
  }

  if (!hasSupabaseAdmin() || !staff.userId) {
    return NextResponse.json({ ok: true, mode: "demo", patient_id: id, volunteer_id: volunteerId, assigned_follow_ups: 0 });
  }

  const { data, error } = await createAdminClient().rpc("assign_volunteer_to_patient", {
    p_patient_id: id,
    p_volunteer_id: volunteerId,
    p_actor_id: staff.userId
  });

  if (error) {
    const mapped = rpcErrors[typeof error.code === "string" ? error.code : ""];
    if (mapped) return NextResponse.json({ ok: false, error: mapped.error }, { status: mapped.status });
    return NextResponse.json({ ok: false, error: "มอบหมายไม่สำเร็จ" }, { status: 500 });
  }

  let delivery = null;
  try { delivery = await dispatchNotifications({ recipientProfileId: volunteerId }); }
  catch { /* Pending messages remain in the outbox. */ }
  return NextResponse.json({ ok: true, mode: "database", ...(data as Record<string, unknown>), delivery });
}
