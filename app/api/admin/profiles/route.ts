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
    ? await supabase.from("line_account_links").select("profile_id, line_account_id, status").eq("role", "volunteer").in("profile_id", volunteerIds)
    : { data: [] };
  const activeLinks = (links ?? []).filter((link) => link.status === "active");
  const accountIds = [...new Set(activeLinks.map((link) => link.line_account_id))] as string[];
  const { data: accounts } = accountIds.length
    ? await supabase.from("line_accounts").select("id, display_name").in("id", accountIds)
    : { data: [] };
  const accountNameMap = new Map((accounts ?? []).map((account) => [account.id, account.display_name]));
  const linkMap = new Map(activeLinks.map((link) => [link.profile_id, link.line_account_id]));

  const profiles = (data ?? []).map((profile) => {
    const accountId = profile.role === "volunteer" ? linkMap.get(profile.id) : undefined;
    return {
      ...profile,
      line_linked: Boolean(accountId),
      line_display_name: accountId ? accountNameMap.get(accountId) ?? null : null
    };
  });

  return NextResponse.json({ ok: true, mode: "database", profiles });
}
