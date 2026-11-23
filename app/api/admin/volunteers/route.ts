import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";

export const runtime = "nodejs";

type CreateBody = {
  fullName?: unknown;
  phone?: unknown;
};

export async function POST(request: Request) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as CreateBody;
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;

  if (!fullName) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อ อสม." }, { status: 422 });
  }

  if (!hasSupabaseAdmin() || !staff.serviceUnitId) {
    return NextResponse.json({ ok: true, mode: "demo", id: "demo" });
  }

  const supabase = createAdminClient();

  // อสม. sign in ผ่าน LINE (ไม่ใช่ email/password) — สร้าง auth user placeholder
  // เพื่อผูก profiles.id ตาม schema (profiles.id references auth.users.id).
  const email = `vhv-${randomBytes(6).toString("hex")}@srkolo.invalid`;
  const password = randomBytes(18).toString("base64url");
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (authError || !authUser.user) {
    return NextResponse.json({ ok: false, error: "สร้างบัญชี อสม. ไม่สำเร็จ" }, { status: 500 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({ id: authUser.user.id, full_name: fullName, role: "volunteer", service_unit_id: staff.serviceUnitId, active: true, phone })
    .select("id")
    .single();
  if (profileError || !profile) {
    return NextResponse.json({ ok: false, error: "สร้างข้อมูล อสม. ไม่สำเร็จ" }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    actor_id: staff.userId,
    actor_role: "nurse",
    service_unit_id: staff.serviceUnitId,
    action: "volunteer_created",
    entity_type: "profile",
    entity_id: profile.id,
    after_data: { full_name: fullName }
  });

  return NextResponse.json({ ok: true, mode: "database", id: profile.id });
}
