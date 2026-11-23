import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";

function validToken(appointmentId: string, token: string) {
  const secret = process.env.CHECKIN_SIGNING_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(appointmentId).digest("hex");
  const left = Buffer.from(expected); const right = Buffer.from(token);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const { appointmentId, token } = await request.json() as { appointmentId?: string; token?: string };
  if (!appointmentId || !token) return NextResponse.json({ error: "ลิงก์เช็กอินไม่สมบูรณ์" }, { status: 422 });
  if (!hasSupabaseAdmin() && appointmentId === "demo" && token === "demo") return NextResponse.json({ ok: true, mode: "demo" });
  if (!validToken(appointmentId, token)) return NextResponse.json({ error: "ลิงก์เช็กอินไม่ถูกต้อง" }, { status: 401 });
  const supabase = createAdminClient();
  const { error } = await supabase.from("check_ins").upsert({ appointment_id: appointmentId }, { onConflict: "appointment_id" });
  if (error) return NextResponse.json({ error: "บันทึกเช็กอินไม่สำเร็จ" }, { status: 500 });
  await supabase.from("appointments").update({ status: "attended", attended_at: new Date().toISOString() }).eq("id", appointmentId);
  return NextResponse.json({ ok: true, mode: "database" });
}
