import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { readSession } from "@/lib/line/session";
import { toActiveContexts } from "@/lib/line/context";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!hasSupabaseAdmin()) return NextResponse.json({ ok: false, error: "database_required" }, { status: 503 });

  const supabase = createAdminClient();
  const { data: links, error } = await supabase
    .from("line_account_links")
    .select("id, line_account_id, role, status")
    .eq("line_account_id", session.lineAccountId);
  if (error) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });

  const contexts = toActiveContexts(links ?? [], session.lineAccountId);
  return NextResponse.json({ ok: true, contexts });
}
