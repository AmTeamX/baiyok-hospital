import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";

export async function GET() {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  if (!hasSupabaseAdmin() || !staff.serviceUnitId) {
    return NextResponse.json({ ok: true, mode: "demo", notifications: [] });
  }

  const supabase = createAdminClient();
  const { data: volunteers } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "volunteer")
    .eq("service_unit_id", staff.serviceUnitId);

  const volunteerIds = (volunteers ?? []).map((volunteer) => volunteer.id);
  const nameMap = new Map((volunteers ?? []).map((volunteer) => [volunteer.id, volunteer.full_name]));
  if (!volunteerIds.length) return NextResponse.json({ ok: true, mode: "database", notifications: [] });

  const { data, error } = await supabase
    .from("notification_logs")
    .select("id, kind, channel, status, attempt_count, next_attempt_at, last_attempt_at, sent_at, created_at, error_message, recipient_profile_id, follow_up_id")
    .in("recipient_profile_id", volunteerIds)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ ok: false, error: "อ่านรายการแจ้งเตือนไม่สำเร็จ" }, { status: 500 });

  const notifications = (data ?? []).map((item) => ({
    id: item.id,
    kind: item.kind,
    channel: item.channel,
    status: item.status,
    attempt_count: item.attempt_count,
    next_attempt_at: item.next_attempt_at,
    last_attempt_at: item.last_attempt_at,
    sent_at: item.sent_at,
    created_at: item.created_at,
    error_message: item.error_message,
    recipient_name: item.recipient_profile_id ? nameMap.get(item.recipient_profile_id) ?? "อสม." : "อสม.",
    follow_up_id: item.follow_up_id
  }));

  return NextResponse.json({ ok: true, mode: "database", notifications });
}
