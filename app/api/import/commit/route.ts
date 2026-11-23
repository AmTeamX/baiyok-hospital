import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { parseImportFile, type AppointmentImportRow, type ImportKind, type ServiceResultImportRow } from "@/lib/import/parser";
import { requireClinicalStaff } from "@/lib/supabase/server";

function getKind(value: FormDataEntryValue | null): ImportKind {
  return value === "service_results" ? "service_results" : "appointments";
}

export async function POST(request: Request) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!hasSupabaseAdmin() || !staff.userId) return NextResponse.json({ ok: false, error: "database_required" }, { status: 503 });
  const form = await request.formData();
  const file = form.get("file");
  const kind = getKind(form.get("kind"));
  if (!(file instanceof File)) return NextResponse.json({ ok: false, errors: ["ไม่พบไฟล์"] }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = createHash("sha256").update(buffer).digest("hex");
    const parsed = await parseImportFile(file, kind);
    if (parsed.invalidRows || !parsed.validRows) {
      return NextResponse.json({ ok: false, rows: parsed.totalRows, valid: parsed.validRows, invalid: parsed.invalidRows, errors: parsed.errors }, { status: 422 });
    }

    const supabase = createAdminClient();

    if (kind === "appointments") {
      const rows = (parsed.rows as AppointmentImportRow[]).map((row) => ({
        hn: row.hn,
        full_name: row.fullName,
        phone: row.phone,
        village: row.village,
        appointment_at: row.appointmentAt,
        clinic: row.clinic,
        service_result: row.serviceResult
      }));
      const { data, error } = await supabase.rpc("commit_import_batch", {
        p_kind: kind,
        p_filename: file.name,
        p_checksum: checksum,
        p_created_by: staff.userId,
        p_rows: rows
      });
      if (error) throw error;
      const result = data as { batch_id: string; idempotent?: boolean; rows?: number; attended?: number };
      return NextResponse.json({ ok: true, batchId: result.batch_id, idempotent: result.idempotent ?? false, rows: parsed.totalRows, valid: parsed.validRows, invalid: 0, attended: result.attended ?? 0, kind });
    }

    const rows = (parsed.rows as ServiceResultImportRow[]).map((row) => ({
      hn: row.hn,
      service_date: row.serviceDate,
      clinic: row.clinic,
      service_result: row.serviceResult,
      external_reference: row.externalReference
    }));
    const { data, error } = await supabase.rpc("commit_service_result_batch", {
      p_filename: file.name,
      p_checksum: checksum,
      p_created_by: staff.userId,
      p_rows: rows,
      p_tolerance_days: 0
    });
    if (error) throw error;
    const result = data as { batch_id: string; idempotent?: boolean; matched?: number; unmatched?: number; ambiguous?: number };
    return NextResponse.json({
      ok: true,
      batchId: result.batch_id,
      idempotent: result.idempotent ?? false,
      rows: parsed.totalRows,
      valid: parsed.validRows,
      invalid: 0,
      matched: result.matched ?? 0,
      unmatched: result.unmatched ?? 0,
      ambiguous: result.ambiguous ?? 0,
      kind
    });
  } catch (error) {
    return NextResponse.json({ ok: false, errors: [error instanceof Error ? error.message : "นำเข้าไม่สำเร็จ"] }, { status: 422 });
  }
}
