import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบ อสม." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const active = body?.active === true || body?.active === false ? Boolean(body.active) : null;
  if (active === null) return NextResponse.json({ ok: false, error: "ต้องระบุสถานะ active" }, { status: 422 });

  if (!hasSupabaseAdmin() || !staff.serviceUnitId) {
    return NextResponse.json({ ok: true, mode: "demo", id, active });
  }

  const supabase = createAdminClient();
  const { data: volunteer, error: readError } = await supabase
    .from("profiles")
    .select("id, role, service_unit_id")
    .eq("id", id)
    .eq("role", "volunteer")
    .single();
  if (readError || !volunteer) return NextResponse.json({ ok: false, error: "ไม่พบ อสม." }, { status: 404 });
  if (volunteer.service_unit_id !== staff.serviceUnitId) return NextResponse.json({ ok: false, error: "ไม่มีสิทธิ์จัดการ อสม. นอกหน่วยบริการ" }, { status: 403 });

  const { error } = await supabase.from("profiles").update({ active }).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: "อัปเดตสถานะ อสม. ไม่สำเร็จ" }, { status: 500 });

  await supabase.from("audit_logs").insert({
    actor_id: staff.userId,
    actor_role: "nurse",
    service_unit_id: staff.serviceUnitId,
    action: active ? "volunteer_activated" : "volunteer_deactivated",
    entity_type: "profile",
    entity_id: id,
    after_data: { active }
  });

  return NextResponse.json({ ok: true, mode: "database", id, active });
}
