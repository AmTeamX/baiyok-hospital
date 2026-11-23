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

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, phone")
    .eq("service_unit_id", staff.serviceUnitId)
    .order("role", { ascending: true })
    .order("full_name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });

  const volunteerIds = (data ?? []).filter((profile) => profile.role === "volunteer").map((profile) => profile.id);
  const { data: links } = volunteerIds.length
    ? await supabase.from("line_account_links").select("profile_id, status").eq("role", "volunteer").in("profile_id", volunteerIds)
    : { data: [] };
  const linkedIds = new Set((links ?? []).filter((link) => link.status === "active").map((link) => link.profile_id));

  const profiles = (data ?? []).map((profile) => ({
    ...profile,
    line_linked: profile.role === "volunteer" ? linkedIds.has(profile.id) : false
  }));

  return NextResponse.json({ ok: true, mode: "database", profiles });
}
