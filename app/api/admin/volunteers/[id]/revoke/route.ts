import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";
import { unlinkRichMenuFromUser } from "@/lib/line/rich-menu";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  if (!hasSupabaseAdmin() || !staff.serviceUnitId) {
    return NextResponse.json({ ok: true, mode: "demo", revoked: false });
  }

  const supabase = createAdminClient();
  const { data: link } = await supabase
    .from("line_account_links")
    .select("id, line_account_id")
    .eq("role", "volunteer")
    .eq("profile_id", id)
    .eq("status", "active")
    .maybeSingle();
  if (!link) return NextResponse.json({ ok: true, mode: "database", revoked: false });

  const { error: revokeError } = await supabase
    .from("line_account_links")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", link.id);
  if (revokeError) return NextResponse.json({ ok: false, error: "ถอนการผูกไม่สำเร็จ" }, { status: 500 });

  // Reset the Rich Menu (best-effort; must never block the revoke).
  try {
    const { data: account } = await supabase.from("line_accounts").select("line_user_id").eq("id", link.line_account_id).single();
    if (account?.line_user_id && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      await unlinkRichMenuFromUser(account.line_user_id, { channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN });
    }
  } catch {
    // Non-fatal.
  }

  await supabase.from("audit_logs").insert({
    actor_id: staff.userId,
    actor_role: "nurse",
    service_unit_id: staff.serviceUnitId,
    action: "line_link_revoked",
    entity_type: "line_account_link",
    entity_id: link.id,
    after_data: { profile_id: id }
  });

  return NextResponse.json({ ok: true, mode: "database", revoked: true });
}
