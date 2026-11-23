import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyLiffIdToken } from "@/lib/line/liff";
import { consumeNonce, getSessionSecret, setSessionCookie, LIFF_SESSION_TTL_SECONDS } from "@/lib/line/session";
import { toActiveContexts } from "@/lib/line/context";

export async function POST(request: Request) {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
  if (!liffId || !getSessionSecret()) return NextResponse.json({ ok: false, error: "session_not_configured" }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (typeof body?.idToken !== "string" || typeof body?.nonce !== "string") return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 422 });
  if (!await consumeNonce(body.nonce)) return NextResponse.json({ ok: false, error: "invalid_nonce" }, { status: 401 });
  const verified = await verifyLiffIdToken(body.idToken, liffId.split("-")[0]);
  if (!verified.ok) return NextResponse.json({ ok: false, error: verified.reason }, { status: 401 });
  if (!hasSupabaseAdmin()) return NextResponse.json({ ok: false, error: "database_required" }, { status: 503 });
  const supabase = createAdminClient();
  const { data: account, error } = await supabase.from("line_accounts").select("id").eq("line_user_id", verified.lineUserId).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });
  if (!account) return NextResponse.json({ ok: false, error: "account_not_linked" }, { status: 404 });
  const { data: links, error: linksError } = await supabase.from("line_account_links").select("id, line_account_id, role, status").eq("line_account_id", account.id);
  if (linksError) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });
  const contexts = toActiveContexts(links ?? [], account.id);
  const set = await setSessionCookie({ lineAccountId: account.id, lineUserId: verified.lineUserId, exp: Math.floor(Date.now() / 1000) + LIFF_SESSION_TTL_SECONDS });
  if (!set) return NextResponse.json({ ok: false, error: "session_not_configured" }, { status: 503 });
  return NextResponse.json({ ok: true, contexts });
}
