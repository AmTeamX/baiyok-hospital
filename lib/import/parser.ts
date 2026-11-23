import { readSheet } from "read-excel-file/node";

export const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;
export type ImportKind = "appointments" | "service_results";
export type ImportError = { row: number; field?: string; code: string; message: string };
export type AppointmentImportRow = { hn: string; fullName: string; phone: string | null; village: string | null; appointmentAt: string; clinic: string; serviceResult: string | null };
export type ServiceResultImportRow = { hn: string; serviceDate: string; clinic: string; serviceResult: string; externalReference: string | null };
export type ParsedImport = { kind: ImportKind; headers: string[]; totalRows: number; validRows: number; invalidRows: number; errors: ImportError[]; rows: Array<AppointmentImportRow | ServiceResultImportRow> };

function parseCsv(text: string): string[][] {
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
  if (value || row.length) { row.push(value.trim()); if (row.some(Boolean)) rows.push(row); }
  return rows;
}
function cell(row: unknown[], headers: string[], name: string) { return String(row[headers.indexOf(name)] ?? "").trim(); }
function normalizeHeader(value: unknown) { return String(value ?? "").trim().toLowerCase().replace(/^\uFEFF/, ""); }
function parseDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = String(value ?? "").trim(); if (!raw) return null;
  const parts = raw.split(/[/-]/).map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    let first = parts[0]; const second = parts[1]; let third = parts[2];
    if (first > 2400) first -= 543; if (third > 2400) third -= 543;
    const year = first > 31 ? first : third; const day = first > 31 ? third : first;
    const candidate = new Date(Date.UTC(year, second - 1, day));
    if (candidate.getUTCFullYear() === year && candidate.getUTCMonth() === second - 1 && candidate.getUTCDate() === day) return candidate.toISOString().slice(0, 10);
  }
  const iso = raw.slice(0, 10); const candidate = new Date(iso + "T00:00:00Z");
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(candidate.getTime()) ? iso : null;
}
function parseTime(value: string) {
  const raw = value || "08:00"; const match = raw.match(/^(\d{1,2}):(\d{2})/); if (!match) return null;
  const hour = Number(match[1]); const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? String(hour).padStart(2, "0") + ":" + match[2] : null;
}
function rowKey(row: AppointmentImportRow | ServiceResultImportRow, kind: ImportKind) {
  return kind === "appointments" ? row.hn + "|" + (row as AppointmentImportRow).appointmentAt + "|" + row.clinic : row.hn + "|" + (row as ServiceResultImportRow).serviceDate + "|" + row.clinic;
}
export async function parseImportFile(file: File, kind: ImportKind): Promise<ParsedImport> {
  if (file.size > MAX_IMPORT_FILE_SIZE) throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 10 MB");
  const buffer = Buffer.from(await file.arrayBuffer());
  const matrix = file.name.toLowerCase().endsWith(".csv") ? parseCsv(buffer.toString("utf8")) : await readSheet(buffer) as unknown[][];
  const headers = (matrix[0] ?? []).map(normalizeHeader); const sourceRows = matrix.slice(1).filter((row) => row.some((value) => String(value ?? "").trim()));
  const required = kind === "appointments" ? ["hn", "full_name", "appointment_date", "clinic"] : ["hn", "service_date", "clinic", "service_result"];
  const hasServiceDateAlias = kind === "service_results" && !headers.includes("service_date") && headers.includes("appointment_date");
  const missing = required.filter((field) => !headers.includes(field) && !(field === "service_date" && hasServiceDateAlias));
  if (missing.length) return { kind, headers, totalRows: sourceRows.length, validRows: 0, invalidRows: sourceRows.length, errors: missing.map((field) => ({ row: 1, field, code: "missing_column", message: "ขาดคอลัมน์: " + field })), rows: [] };
  const errors: ImportError[] = []; const rows: Array<AppointmentImportRow | ServiceResultImportRow> = []; const seen = new Set<string>();
  sourceRows.forEach((source, index) => {
    const rowNumber = index + 2; const hn = cell(source, headers, "hn"); const clinic = cell(source, headers, "clinic");
    if (!hn) errors.push({ row: rowNumber, field: "hn", code: "required", message: "ต้องมี HN" });
    if (!clinic) errors.push({ row: rowNumber, field: "clinic", code: "required", message: "ต้องมีคลินิก" });
    if (kind === "appointments") {
      const fullName = cell(source, headers, "full_name"); const date = parseDate(cell(source, headers, "appointment_date")); const time = parseTime(cell(source, headers, "appointment_time"));
      if (!fullName) errors.push({ row: rowNumber, field: "full_name", code: "required", message: "ต้องมีชื่อผู้ป่วย" });
      if (!date) errors.push({ row: rowNumber, field: "appointment_date", code: "invalid_date", message: "วันที่นัดไม่ถูกต้อง" });
      if (!time) errors.push({ row: rowNumber, field: "appointment_time", code: "invalid_time", message: "เวลาไม่ถูกต้อง" });
      if (hn && date && time && clinic) {
        const normalized: AppointmentImportRow = { hn, fullName, phone: cell(source, headers, "phone") || null, village: cell(source, headers, "village") || null, appointmentAt: date + "T" + time + ":00+07:00", clinic, serviceResult: cell(source, headers, "service_result") || null };
        const key = rowKey(normalized, kind); if (seen.has(key)) errors.push({ row: rowNumber, code: "duplicate", message: "รายการนัดซ้ำในไฟล์" }); else { seen.add(key); rows.push(normalized); }
      }
    } else {
      const dateColumn = headers.includes("service_date") ? "service_date" : "appointment_date"; const serviceDate = parseDate(cell(source, headers, dateColumn)); const serviceResult = cell(source, headers, "service_result");
      if (!serviceDate) errors.push({ row: rowNumber, field: "service_date", code: "invalid_date", message: "วันที่มารับบริการไม่ถูกต้อง" });
      if (!serviceResult) errors.push({ row: rowNumber, field: "service_result", code: "required", message: "ต้องมีผลการรับบริการ" });
      if (hn && serviceDate && clinic && serviceResult) {
        const normalized: ServiceResultImportRow = { hn, serviceDate, clinic, serviceResult, externalReference: cell(source, headers, "external_reference") || null }; const key = rowKey(normalized, kind);
        if (seen.has(key)) errors.push({ row: rowNumber, code: "duplicate", message: "ผลบริการซ้ำในไฟล์" }); else { seen.add(key); rows.push(normalized); }
      }
    }
  });
  const errorRows = new Set(errors.map((error) => error.row));
  return { kind, headers, totalRows: sourceRows.length, validRows: sourceRows.length - errorRows.size, invalidRows: errorRows.size, errors, rows };
}

