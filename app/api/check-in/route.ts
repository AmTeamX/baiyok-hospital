import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyCheckInToken } from "@/lib/check-in-token";

export const runtime = "nodejs";

const rpcErrors: Record<string, { status: number; error: string }> = {
  P0002: { status: 404, error: "ไม่พบรายการนัด" },
  P0006: { status: 409, error: "นัดนี้ถูกยกเลิกแล้ว" }
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { appointmentId?: string; token?: string };
  if (!body.appointmentId || !body.token) {
    return NextResponse.json({ error: "ลิงก์เช็กอินไม่สมบูรณ์" }, { status: 422 });
  }

  if (!hasSupabaseAdmin()) {
    if (body.appointmentId === "demo" && body.token === "demo") return NextResponse.json({ ok: true, mode: "demo" });
    return NextResponse.json({ error: "ลิงก์เช็กอินไม่ถูกต้องหรือหมดอายุ" }, { status: 401 });
  }

  const verified = verifyCheckInToken(body.token);
  if (!verified) {
    return NextResponse.json({ error: "ลิงก์เช็กอินไม่ถูกต้องหรือหมดอายุ" }, { status: 401 });
  }
  if (verified.appointmentId !== body.appointmentId) {
    return NextResponse.json({ error: "ลิงก์เช็กอินไม่ตรงกับรายการนัด" }, { status: 401 });
  }

  const { data, error } = await createAdminClient().rpc("check_in_appointment", {
    p_appointment_id: verified.appointmentId,
    p_nonce: verified.nonce,
    p_channel: "qr"
  });

  if (error) {
    const mapped = rpcErrors[typeof error.code === "string" ? error.code : ""];
    if (mapped) return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    return NextResponse.json({ error: "บันทึกเช็กอินไม่สำเร็จ" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mode: "database", ...(data as Record<string, unknown>) });
}
