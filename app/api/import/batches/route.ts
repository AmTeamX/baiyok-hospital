import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";

export async function GET() {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!hasSupabaseAdmin()) return NextResponse.json({ ok: true, mode: "demo", batches: [] });
  const { data, error } = await createAdminClient().from("import_batches").select("id, kind, filename, status, total_rows, valid_rows, invalid_rows, created_at, committed_at").order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ ok: false, error: "อ่านประวัติการนำเข้าไม่สำเร็จ" }, { status: 500 });
  return NextResponse.json({ ok: true, batches: data ?? [] });
}

