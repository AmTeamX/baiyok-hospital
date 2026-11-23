import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { readSession, setContextCookie } from "@/lib/line/session";
import { isContextStillActive, type LineLinkRole } from "@/lib/line/context";

type ContextBody = {
  linkId?: string;
  role?: string;
};

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: ContextBody;
  try {
    body = (await request.json()) as ContextBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!body.linkId || (body.role !== "patient" && body.role !== "volunteer")) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 422 });
  }

  if (!hasSupabaseAdmin()) return NextResponse.json({ ok: false, error: "database_required" }, { status: 503 });
  const supabase = createAdminClient();
  const { data: links, error } = await supabase
    .from("line_account_links")
    .select("id, line_account_id, role, status")
    .eq("line_account_id", session.lineAccountId);
  if (error) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });

  const context = { linkId: body.linkId, role: body.role as LineLinkRole };
  if (!isContextStillActive(links ?? [], context)) {
    return NextResponse.json({ ok: false, error: "context_revoked" }, { status: 403 });
  }

  const set = await setContextCookie({
    linkId: context.linkId,
    lineAccountId: session.lineAccountId,
    role: context.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24
  });
  if (!set) return NextResponse.json({ ok: false, error: "session_not_configured" }, { status: 503 });

  return NextResponse.json({ ok: true, role: context.role });
}
