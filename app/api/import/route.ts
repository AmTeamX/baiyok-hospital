import { NextResponse } from "next/server";
import { readSheet } from "read-excel-file/node";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";

const required = ["hn", "full_name", "appointment_date", "clinic"];

function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]; const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value.trim()); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = "";
    } else value += char;
  }
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

function cellValue(row: Array<unknown>, headers: string[], column: string) {
  return row[headers.indexOf(column)] ?? "";
}

function isoAppointment(dateValue: unknown, timeValue: unknown) {
  const date = dateValue instanceof Date
    ? dateValue.toISOString().slice(0, 10)
    : String(dateValue).trim().slice(0, 10);
  const time = String(timeValue || "08:00").trim().slice(0, 5).padEnd(5, "0");
  return `${date}T${time}:00+07:00`;
}

export async function POST(request: Request) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, rows: 0, valid: 0, invalid: 0, errors: ["ไม่พบไฟล์"] }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ ok: false, rows: 0, valid: 0, invalid: 0, errors: ["ไฟล์ต้องมีขนาดไม่เกิน 10 MB"] }, { status: 400 });
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const matrix: Array<Array<unknown>> = file.name.toLowerCase().endsWith(".csv")
      ? parseCsv(buffer.toString("utf8"))
      : await readSheet(buffer) as Array<Array<unknown>>;
    const headers = (matrix[0] ?? []).map(cell => String(cell ?? "").trim().toLowerCase());
    const rows = matrix.slice(1);
    const missing = required.filter(column => !headers.includes(column));
    if (missing.length) return NextResponse.json({ ok: false, rows: rows.length, valid: 0, invalid: rows.length, errors: [`ขาดคอลัมน์: ${missing.join(", ")}`] }, { status: 422 });
    const requiredIndexes = required.map(column => headers.indexOf(column));
    const invalid = rows.filter(row => requiredIndexes.some(index => !String(row[index] ?? "").trim())).length;
    const validRows = rows.filter(row => requiredIndexes.every(index => String(row[index] ?? "").trim()));

    if (hasSupabaseAdmin() && validRows.length) {
      const supabase = createAdminClient(); const importBatch = crypto.randomUUID();
      const patientRows = validRows.map(row => ({
        hn: String(cellValue(row, headers, "hn")).trim(),
        full_name: String(cellValue(row, headers, "full_name")).trim(),
        phone: String(cellValue(row, headers, "phone")).trim() || null,
        village: String(cellValue(row, headers, "village")).trim() || null
      }));
      const { data: patients, error: patientError } = await supabase.from("patients").upsert(patientRows, { onConflict: "hn" }).select("id, hn");
      if (patientError) throw patientError;
      const ids = new Map((patients ?? []).map(patient => [patient.hn, patient.id]));
      const appointmentRows = validRows.map(row => {
        const result = String(cellValue(row, headers, "service_result")).trim();
        return {
          patient_id: ids.get(String(cellValue(row, headers, "hn")).trim()),
          appointment_at: isoAppointment(cellValue(row, headers, "appointment_date"), cellValue(row, headers, "appointment_time")),
          clinic: String(cellValue(row, headers, "clinic")).trim(),
          status: result ? "attended" : "scheduled",
          attended_at: result ? new Date().toISOString() : null,
          import_batch: importBatch
        };
      });
      const { error: appointmentError } = await supabase.from("appointments").upsert(appointmentRows, { onConflict: "patient_id,appointment_at,clinic" });
      if (appointmentError) throw appointmentError;
    }

    return NextResponse.json({ ok: true, rows: rows.length, valid: validRows.length, invalid, mode: hasSupabaseAdmin() ? "database" : "preview" });
  } catch { return NextResponse.json({ ok: false, rows: 0, valid: 0, invalid: 0, errors: ["อ่านไฟล์ไม่ได้ กรุณาตรวจรูปแบบ Excel/CSV"] }, { status: 422 }); }
}
