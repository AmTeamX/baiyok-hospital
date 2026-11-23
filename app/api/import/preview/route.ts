import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { parseImportFile, type ImportKind } from "@/lib/import/parser";
import { requireClinicalStaff } from "@/lib/supabase/server";

function getKind(value: FormDataEntryValue | null): ImportKind {
  return value === "service_results" ? "service_results" : "appointments";
}
export async function POST(request: Request) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, errors: ["ไม่พบไฟล์"] }, { status: 400 });
  const kind = getKind(form.get("kind"));
  try {
    const parsed = await parseImportFile(file, kind);
    const checksum = createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex");
    return NextResponse.json({
      ok: parsed.invalidRows === 0 && parsed.validRows > 0,
      previewOnly: true, kind, checksum, filename: file.name,
      rows: parsed.totalRows, valid: parsed.validRows, invalid: parsed.invalidRows,
      errors: parsed.errors, preview: parsed.rows.slice(0, 50)
    }, { status: parsed.invalidRows || !parsed.validRows ? 422 : 200 });
  } catch (error) {
    return NextResponse.json({ ok: false, errors: [error instanceof Error ? error.message : "อ่านไฟล์ไม่ได้ กรุณาตรวจรูปแบบ Excel/CSV"] }, { status: 422 });
  }
}

