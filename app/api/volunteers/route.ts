import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";

const demoVolunteers = [
  { id: "vhv-mali", full_name: "อสม. มาลี", active: true, phone: null },
  { id: "vhv-chan", full_name: "อสม. ชาญ", active: true, phone: null },
  { id: "vhv-nid", full_name: "อสม. นิด", active: true, phone: null }
];

export async function GET() {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  if (!hasSupabaseAdmin() || !staff.serviceUnitId) {
    return NextResponse.json({ ok: true, mode: "demo", volunteers: demoVolunteers });
  }

  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, full_name, active, phone")
    .eq("role", "volunteer")
    .eq("service_unit_id", staff.serviceUnitId)
    .order("active", { ascending: false })
    .order("full_name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: "อ่านรายชื่อ อสม. ไม่สำเร็จ" }, { status: 500 });
  return NextResponse.json({ ok: true, mode: "database", volunteers: data ?? [] });
}
