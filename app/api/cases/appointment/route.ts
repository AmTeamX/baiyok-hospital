import { NextResponse } from "next/server";
import { requireClinicalStaff } from "@/lib/supabase/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasSupabaseAdmin() || !staff.serviceUnitId) return NextResponse.json({ error: "ต้องเชื่อมต่อฐานข้อมูลก่อนเลือกนัด" }, { status: 503 });
  const id = new URL(request.url).searchParams.get("appointmentId") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "ไม่พบนัดนี้" }, { status: 404 });
  const { data, error } = await createAdminClient().from("appointments").select("id, patient_id, patients!inner(service_unit_id)").eq("id", id).eq("patients.service_unit_id", staff.serviceUnitId).maybeSingle();
  if (error) return NextResponse.json({ error: "โหลดนัดไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "ไม่พบนัดนี้หรือไม่มีสิทธิ์เข้าถึง" }, { status: 404 });
  return NextResponse.json({ appointmentId: data.id, patientId: data.patient_id });
}
