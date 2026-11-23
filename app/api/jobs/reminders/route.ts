import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { pushLineText } from "@/lib/line";

function thaiDateOffset(days: number) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const date = new Date(`${today}T12:00:00+07:00`); date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasSupabaseAdmin()) return NextResponse.json({ error: "supabase not configured" }, { status: 503 });

  const target = thaiDateOffset(1);
  const following = thaiDateOffset(2);
  const supabase = createAdminClient();

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, patient_id, appointment_at, clinic")
    .eq("status", "scheduled")
    .gte("appointment_at", `${target}T00:00:00+07:00`)
    .lt("appointment_at", `${following}T00:00:00+07:00`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!appointments?.length) return NextResponse.json({ sent: 0, target });

  const appointmentIds = appointments.map((item) => item.id);
  const patientIds = [...new Set(appointments.map((item) => item.patient_id))];

  // Resolve the LINE user via the active patient link (not the deprecated patients.line_user_id).
  const [{ data: patients }, { data: links }] = await Promise.all([
    supabase.from("patients").select("id, full_name").in("id", patientIds),
    supabase.from("line_account_links").select("patient_id, line_account_id").eq("role", "patient").eq("status", "active").in("patient_id", patientIds)
  ]);
  const accountIds = [...new Set((links ?? []).map((link) => link.line_account_id))];
  const [{ data: accounts }, { data: existing }] = await Promise.all([
    accountIds.length ? supabase.from("line_accounts").select("id, line_user_id").in("id", accountIds) : Promise.resolve({ data: [] }),
    supabase.from("notification_logs").select("appointment_id").eq("kind", "appointment_tomorrow").in("appointment_id", appointmentIds)
  ]);

  const patientMap = new Map((patients ?? []).map((patient) => [patient.id, patient.full_name]));
  const accountMap = new Map((accounts ?? []).map((account) => [account.id, account.line_user_id]));
  const patientLineMap = new Map((links ?? []).map((link) => [link.patient_id, accountMap.get(link.line_account_id) ?? null]));
  const sentIds = new Set((existing ?? []).map((log) => log.appointment_id));

  let sent = 0;
  const failures: string[] = [];

  for (const appointment of appointments) {
    const lineUserId = patientLineMap.get(appointment.patient_id) ?? null;
    if (!lineUserId || sentIds.has(appointment.id)) continue;
    const name = patientMap.get(appointment.patient_id) ?? "ผู้ป่วย";
    const when = new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(appointment.appointment_at));
    try {
      await pushLineText(lineUserId, `แจ้งเตือนวันนัด\nคุณ${name} มีนัด${appointment.clinic}\n${when}\nกรุณานำยาและสมุดประจำตัวมาด้วย หากไม่สะดวกให้แจ้งเจ้าหน้าที่ผ่านเมนู แจ้งปัญหา`);
      await supabase.from("notification_logs").insert({ appointment_id: appointment.id, kind: "appointment_tomorrow", channel: "line", status: "sent" });
      sent += 1;
    } catch (pushError) {
      failures.push(appointment.id);
      await supabase.from("notification_logs").insert({ appointment_id: appointment.id, kind: "appointment_tomorrow", channel: "line", status: "failed", error_message: pushError instanceof Error ? pushError.message : "unknown error" });
    }
  }
  return NextResponse.json({ sent, failed: failures.length, target });
}
