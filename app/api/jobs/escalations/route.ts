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

  const { data, error } = await createAdminClient().rpc("enqueue_sla_reminders");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = data as { enqueued?: number; at?: string };
  const delivery = { sent: 0, failed: 0, unlinked: 0, blocked: 0, processed: 0 };
  try {
    for (let batch = 0; batch < 10; batch += 1) {
      const next = await dispatchNotifications();
      for (const key of Object.keys(delivery) as Array<keyof typeof delivery>) delivery[key] += next[key];
      if (next.processed < 20) break;
    }
  } catch { return NextResponse.json({ enqueued: result.enqueued ?? 0, at: result.at ?? null, delivery, deliveryError: "retry_pending" }); }
  return NextResponse.json({ enqueued: result.enqueued ?? 0, at: result.at ?? null, delivery });
}
