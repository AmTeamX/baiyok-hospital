import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบรายการแจ้งเตือน" }, { status: 404 });

  if (!hasSupabaseAdmin() || !staff.serviceUnitId) {
    return NextResponse.json({ ok: true, mode: "demo", id });
  }

  const supabase = createAdminClient();
  const { data: notification, error: readError } = await supabase
    .from("notification_logs")
    .select("id, status, recipient_profile_id")
    .eq("id", id)
    .single();
  if (readError || !notification) return NextResponse.json({ ok: false, error: "ไม่พบรายการแจ้งเตือน" }, { status: 404 });
  if (notification.status === "unlinked") return NextResponse.json({ ok: false, error: "อสม. ยังไม่ผูก LINE กรุณาผูกบัญชีก่อน" }, { status: 422 });
  if (!["failed", "dead_letter"].includes(notification.status)) return NextResponse.json({ ok: false, error: "รายการนี้ไม่สามารถส่งซ้ำได้" }, { status: 422 });

  const { error } = await supabase
    .from("notification_logs")
    .update({ status: "pending", attempt_count: 0, next_attempt_at: new Date().toISOString(), last_attempt_at: null, error_message: null })
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, error: "ส่งซ้ำไม่สำเร็จ" }, { status: 500 });
  return NextResponse.json({ ok: true, mode: "database", id });
}
