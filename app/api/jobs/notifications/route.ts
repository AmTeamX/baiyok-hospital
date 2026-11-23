import { NextResponse } from "next/server";
import { hasSupabaseAdmin } from "@/lib/supabase/admin";
import { dispatchNotifications } from "@/lib/notification-dispatch";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasSupabaseAdmin()) return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  try { return NextResponse.json(await dispatchNotifications()); }
  catch { return NextResponse.json({ error: "notification_dispatch_failed" }, { status: 500 }); }
}
