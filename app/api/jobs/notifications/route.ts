import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { pushLineText } from "@/lib/line";
import { deliverNotification } from "@/lib/notifications";

const BATCH_SIZE = 20;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasSupabaseAdmin()) return NextResponse.json({ error: "supabase not configured" }, { status: 503 });

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: candidates, error } = await supabase
    .from("notification_logs")
    .select("id, follow_up_id, recipient_profile_id, kind, attempt_count")
    .eq("channel", "line")
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", nowIso)
    .order("next_attempt_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!candidates?.length) return NextResponse.json({ processed: 0 });

  const recipientIds = [...new Set(candidates.map((item: { recipient_profile_id: string | null }) => item.recipient_profile_id).filter(Boolean))] as string[];
  const { data: links } = recipientIds.length
    ? await supabase.from("line_account_links").select("profile_id, line_account_id").eq("role", "volunteer").eq("status", "active").in("profile_id", recipientIds)
    : { data: [] };
  const accountIds = [...new Set((links ?? []).map((link: { line_account_id: string }) => link.line_account_id))];
  const { data: accounts } = accountIds.length
    ? await supabase.from("line_accounts").select("id, line_user_id").in("id", accountIds)
    : { data: [] };
  const accountMap = new Map((accounts ?? []).map((account: { id: string; line_user_id: string | null }) => [account.id, account.line_user_id]));
  const lineUserIdMap = new Map((links ?? []).map((link: { profile_id: string; line_account_id: string }) => [link.profile_id, accountMap.get(link.line_account_id) ?? null]));

  let sent = 0;
  let failed = 0;
  let unlinked = 0;
  let blocked = 0;

  for (const candidate of candidates) {
    const { data: claimed } = await supabase
      .from("notification_logs")
      .update({ status: "processing", attempt_count: candidate.attempt_count + 1, last_attempt_at: nowIso })
      .eq("id", candidate.id)
      .in("status", ["pending", "failed"])
      .select("id")
      .single();
    if (!claimed) continue;

    const lineUserId = candidate.recipient_profile_id ? lineUserIdMap.get(candidate.recipient_profile_id) ?? null : null;
    const result = await deliverNotification(
      { id: candidate.id, followUpId: candidate.follow_up_id, kind: candidate.kind, lineUserId, attemptCountAfterClaim: candidate.attempt_count + 1 },
      pushLineText
    );

    if (result.status === "sent") {
      await supabase.from("notification_logs").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", candidate.id);
      sent += 1;
    } else if (result.status === "unlinked") {
      await supabase.from("notification_logs").update({ status: "unlinked", error_message: "recipient has no linked LINE account" }).eq("id", candidate.id);
      unlinked += 1;
    } else if (result.status === "blocked") {
      await supabase.from("notification_logs").update({ status: "blocked", error_message: result.errorMessage }).eq("id", candidate.id);
      blocked += 1;
    } else {
      await supabase.from("notification_logs").update({
        status: result.status,
        error_message: result.errorMessage,
        next_attempt_at: "nextAttemptAt" in result ? result.nextAttemptAt : null
      }).eq("id", candidate.id);
      failed += 1;
    }
  }

  return NextResponse.json({ processed: candidates.length, sent, failed, unlinked, blocked });
}
