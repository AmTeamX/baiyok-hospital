import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";

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
  return NextResponse.json({ enqueued: result.enqueued ?? 0, at: result.at ?? null });
}
