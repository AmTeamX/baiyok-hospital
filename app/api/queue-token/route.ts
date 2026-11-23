import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";
import { signCheckInToken } from "@/lib/check-in-token";

export async function POST(request: Request) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { hn, date } = (await request.json().catch(() => ({}))) as { hn?: string; date?: string };
  if (!hn || !date) return NextResponse.json({ error: "กรุณาระบุ HN และวันที่นัด" }, { status: 422 });

  let appointmentId = "demo";
  if (hasSupabaseAdmin()) {
    const supabase = createAdminClient();
    const { data: patient } = await supabase.from("patients").select("id").eq("hn", hn).maybeSingle();
    if (!patient) return NextResponse.json({ error: "ไม่พบผู้ป่วย" }, { status: 404 });
    const dayStart = `${date}T00:00:00+07:00`;
    const nextDate = new Date(`${date}T12:00:00+07:00`);
    nextDate.setDate(nextDate.getDate() + 1);
    const dayEnd = `${nextDate.toISOString().slice(0, 10)}T00:00:00+07:00`;
    const { data: appointment } = await supabase
      .from("appointments")
      .select("id")
      .eq("patient_id", patient.id)
      .gte("appointment_at", dayStart)
      .lt("appointment_at", dayEnd)
      .maybeSingle();
    if (!appointment) return NextResponse.json({ error: "ไม่พบนัดในวันที่เลือก" }, { status: 404 });
    appointmentId = appointment.id;
  }

  const token = appointmentId === "demo" ? "demo" : signCheckInToken(appointmentId);
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return NextResponse.json({ url: `${base}/check-in?appointment=${encodeURIComponent(appointmentId)}&token=${encodeURIComponent(token)}` });
}
