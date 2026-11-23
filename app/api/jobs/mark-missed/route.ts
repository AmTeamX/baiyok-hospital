import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { dispatchNotifications } from "@/lib/notification-dispatch";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  const { data, error } = await createAdminClient().rpc("mark_missed_appointments");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = data as { marked?: number; follow_ups_created?: number; at?: string };
  try { await dispatchNotifications(); } catch { /* The outbox retains pending assignments. */ }
  return NextResponse.json({ marked: result.marked ?? 0, followUpsCreated: result.follow_ups_created ?? 0, at: result.at ?? null });
}
