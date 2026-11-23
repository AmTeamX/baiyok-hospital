import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyLiffIdToken } from "@/lib/line/liff";
import { hashLinkToken, type LinkCodeRole } from "@/lib/line/link-code";
import { consumeNonce, setSessionCookie } from "@/lib/line/session";
import { resolveRichMenuId, linkRichMenuToUser, selectRichMenuKind } from "@/lib/line/rich-menu";
import { pushLineText } from "@/lib/line";

type VerifyBody = {
  idToken?: string;
  code?: string;
  nonce?: string;
  role?: string;
};

function parseRole(value: string | undefined): LinkCodeRole | null {
  return value === "patient" || value === "volunteer" ? value : null;
}

function linkCodeError(code: string): { status: number; error: string } {
  switch (code) {
    case "LLC01": return { status: 403, error: "link_code_used" };
    case "LLC02": return { status: 403, error: "link_code_expired" };
    case "LLC04": return { status: 403, error: "link_code_wrong_target" };
    default: return { status: 403, error: "link_code_invalid" };
  }
}

export async function POST(request: Request) {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
  if (!liffId) return NextResponse.json({ ok: false, error: "liff_not_configured" }, { status: 503 });
  // The verify endpoint expects the LINE Login channel ID (the part before '-'
  // in the LIFF ID), not the full LIFF ID. The ID token's `aud` is the channel ID.
  const channelId = liffId.split("-")[0];

  let body: VerifyBody;
  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const role = parseRole(body.role);
  if (!body.idToken || !body.code || !body.nonce) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 422 });
  }

  // Replay protection: the nonce must match the server-issued value and can only be consumed once.
  if (!(await consumeNonce(body.nonce))) {
    return NextResponse.json({ ok: false, error: "invalid_nonce" }, { status: 401 });
  }

  // The ID token's signature, issuer, audience and expiry are verified server-side.
  const verified = await verifyLiffIdToken(body.idToken, channelId);
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.reason, detail: verified.detail }, { status: 401 });
  }

  if (!hasSupabaseAdmin()) return NextResponse.json({ ok: false, error: "database_required" }, { status: 503 });
  const supabase = createAdminClient();

  // The one-time code is authoritative for target + role; the client's role is only cross-checked.
  const { data: consumed, error: consumeError } = await supabase.rpc("consume_line_link_code", {
    p_token_hash: hashLinkToken(body.code),
    p_claimed_role: role
  });
  if (consumeError) {
    const mapped = linkCodeError(consumeError.code ?? "");
    return NextResponse.json({ ok: false, error: mapped.error }, { status: mapped.status });
  }

  const target = consumed as { target_type: "patient" | "profile"; target_id: string; intended_role: LinkCodeRole };
  const resolvedRole = target.intended_role;

  // Re-check that the target is still valid before creating a link.
  if (target.intended_role === "volunteer") {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", target.target_id)
      .eq("role", "volunteer")
      .eq("active", true)
      .maybeSingle();
    if (error || !profile) {
      return NextResponse.json({ ok: false, error: "link_code_wrong_target" }, { status: 403 });
    }
  } else {
    const { data: patient, error } = await supabase
      .from("patients")
      .select("id")
      .eq("id", target.target_id)
      .maybeSingle();
    if (error || !patient) {
      return NextResponse.json({ ok: false, error: "link_code_wrong_target" }, { status: 403 });
    }
  }

  const lineUserId = verified.lineUserId;
  const now = new Date().toISOString();

  const { data: account, error: accountError } = await supabase
    .from("line_accounts")
    .upsert(
      { line_user_id: lineUserId, display_name: verified.claims.name ?? null, picture_url: verified.claims.picture ?? null, friend_status: "added", last_seen_at: now },
      { onConflict: "line_user_id" }
    )
    .select("id")
    .single();
  if (accountError || !account) {
    return NextResponse.json({ ok: false, error: "account_upsert_failed" }, { status: 500 });
  }

  const linkRow = {
    line_account_id: account.id,
    role: resolvedRole,
    patient_id: resolvedRole === "patient" ? target.target_id : null,
    profile_id: resolvedRole === "volunteer" ? target.target_id : null,
    status: "active" as const,
    consented_at: now,
    revoked_at: null,
    verified_at: now
  };

  const { error: linkError } = await supabase
    .from("line_account_links")
    .upsert(linkRow, { onConflict: "line_account_id,role" });
  if (linkError) {
    return NextResponse.json({ ok: false, error: "link_upsert_failed" }, { status: 500 });
  }

  let richMenuStatus = "not_configured";
  try {
    const { data: links, error: rolesError } = await supabase
      .from("line_account_links")
      .select("role")
      .eq("line_account_id", account.id)
      .eq("status", "active");
    if (rolesError) throw new Error("Unable to load linked roles");
    const roles = [...new Set([resolvedRole, ...(links ?? []).map((item) => item.role as "patient" | "volunteer")])];
    const kind = selectRichMenuKind(roles);
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
    const menuId = token ? await resolveRichMenuId(kind, { channelAccessToken: token }) : null;
    if (menuId && token) {
      const linked = await linkRichMenuToUser(lineUserId, menuId, { channelAccessToken: token });
      richMenuStatus = linked ? "linked" : "failed";
      if (linked) {
        await supabase.from("line_accounts").update({ rich_menu_id: menuId, rich_menu_linked_at: now }).eq("id", account.id);
      }
    }
  } catch {
    richMenuStatus = "failed";
  }

  await supabase.from("audit_logs").insert({
    actor_role: null,
    action: "line_link_created",
    entity_type: "line_account_link",
    entity_id: account.id,
    after_data: { role: resolvedRole, line_user_id: lineUserId }
  });

  // Best-effort confirmation push — no health data.
  try {
    if (process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      const confirmMessage = resolvedRole === "volunteer"
        ? "ผูกบัญชี อสม. สำเร็จแล้ว\nเปิดเมนู \"งานของฉัน\" เพื่อดูงานที่ได้รับมอบหมาย"
        : "ผูกบัญชี LINE สำเร็จแล้ว\nเปิดเมนู \"วันนัดของฉัน\" เพื่อดูวันนัดของคุณ";
      await pushLineText(lineUserId, confirmMessage);
    }
  } catch {
    // Non-fatal; the identity link already succeeded.
  }

  const sessionSet = await setSessionCookie({ lineAccountId: account.id, lineUserId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 });
  return NextResponse.json({ ok: true, role: resolvedRole, session: sessionSet, richMenuStatus });
}
