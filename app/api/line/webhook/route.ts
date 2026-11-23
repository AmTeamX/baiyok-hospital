import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";

function validSignature(body: string, signature: string | null) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const digest = createHmac("sha256", secret).update(body).digest("base64");
  const left = Buffer.from(digest); const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const body = await request.text();
  if (!validSignature(body, request.headers.get("x-line-signature"))) return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  const payload = JSON.parse(body) as { events?: Array<{ webhookEventId?: string; type?: string; source?: { userId?: string }; deliveryContext?: { isRedelivery?: boolean } }> };
  const events = payload.events ?? [];
  if (hasSupabaseAdmin() && events.length) {
    const supabase = createAdminClient();
    const rows = events.filter(event => event.webhookEventId).map(event => ({ event_id: event.webhookEventId, event_type: event.type ?? "unknown", line_user_id: event.source?.userId ?? null, is_redelivery: event.deliveryContext?.isRedelivery ?? false }));
    if (rows.length) await supabase.from("line_webhook_events").upsert(rows, { onConflict: "event_id", ignoreDuplicates: true });
  }
  // Return quickly. Message processing and replies should run in a durable queue in production.
  return NextResponse.json({ accepted: events.length });
}
