import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  if (!hasSupabaseAdmin() || !staff.serviceUnitId) {
    return NextResponse.json({ ok: true, mode: "demo", profiles: [] });
  }

  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, full_name, role, active, phone")
    .eq("service_unit_id", staff.serviceUnitId)
    .order("role", { ascending: true })
    .order("full_name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });

  return NextResponse.json({ ok: true, mode: "database", profiles: data ?? [] });
}
