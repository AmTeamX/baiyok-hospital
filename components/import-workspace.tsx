"use client";

import { CheckCircle2, FileSpreadsheet, LoaderCircle, UploadCloud, XCircle } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

type ImportKind = "appointments" | "service_results";
type ImportError = { row: number; field?: string; code: string; message: string };
type ImportResult = { ok: boolean; previewOnly?: boolean; kind: ImportKind; filename?: string; checksum?: string; rows: number; valid: number; invalid: number; errors?: ImportError[]; batchId?: string; idempotent?: boolean };

export function ImportWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null); const [kind, setKind] = useState<ImportKind>("appointments");
  const [status, setStatus] = useState<"idle" | "previewing" | "committing" | "success" | "error">("idle"); const [result, setResult] = useState<ImportResult | null>(null);

  async function preview() {
    if (!file) return; setStatus("previewing"); setResult(null);
    const body = new FormData(); body.append("file", file); body.append("kind", kind);
    try {
      const response = await fetch("/api/import/preview", { method: "POST", body }); const data = await response.json(); setResult(data); setStatus(response.ok ? "success" : "error");
    } catch { setResult({ ok: false, kind, rows: 0, valid: 0, invalid: 0, errors: [{ row: 0, code: "network", message: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่" }] }); setStatus("error"); }
  }
  async function commit() {
    if (!file || !result?.ok) return; setStatus("committing");
    const body = new FormData(); body.append("file", file); body.append("kind", kind); body.append("checksum", result.checksum ?? "");
    try { const response = await fetch("/api/import/commit", { method: "POST", body }); const data = await response.json(); setResult({ ...result, ...data }); setStatus(response.ok ? "success" : "error"); }
    catch { setResult({ ...result, ok: false, errors: [{ row: 0, code: "network", message: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่" }] }); setStatus("error"); }
  }
  const errors = result?.errors ?? [];
  return <div className="import-layout">
    <section className="panel upload-panel">
      <div className="field"><span>ชนิดข้อมูล</span><select value={kind} onChange={(event) => { setKind(event.target.value as ImportKind); setResult(null); setStatus("idle"); }}><option value="appointments">รายการนัด</option><option value="service_results">ผลมารับบริการ</option></select></div>
      <ol className="import-steps" aria-label="ขั้นตอนนำเข้า"><li className={file ? "done" : "active"}>1 เลือกไฟล์</li><li className={result?.previewOnly ? "active" : ""}>2 ตรวจสอบ</li><li className={result && !result.previewOnly && result.ok ? "active" : ""}>3 ยืนยัน</li></ol>
      <button className={"drop-zone " + (file ? "has-file" : "")} onClick={() => inputRef.current?.click()} type="button" disabled={status === "previewing" || status === "committing"}>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(event) => { const next = event.target.files?.[0] ?? null; setFile(next); setStatus("idle"); setResult(null); }} />
        {file ? <><FileSpreadsheet size={40} /><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(1)} KB · กดเพื่อเปลี่ยนไฟล์</span></> : <><UploadCloud size={44} /><strong>เลือกไฟล์จากเครื่อง</strong><span>.xlsx, .xls หรือ .csv ขนาดไม่เกิน 10 MB</span></>}
      </button>
      <button className="button primary wide" onClick={preview} disabled={!file || status === "previewing" || status === "committing"}>{status === "previewing" ? <><LoaderCircle className="spin" size={18} />กำลังตรวจข้อมูล…</> : "ตรวจสอบไฟล์"}</button><Link className="text-link" href="/imports">ดูประวัติชุดข้อมูลที่นำเข้า →</Link>
      {result && <div className={"import-result " + (result.ok ? "success" : "error")} role="status">{result.ok ? <CheckCircle2 /> : <XCircle />}<div><strong>{result.ok ? (result.previewOnly ? "ตรวจข้อมูลผ่าน กรุณายืนยันนำเข้า" : "นำเข้าสำเร็จ") : "ยังนำเข้าไม่ได้"}</strong><p>ทั้งหมด {result.rows} แถว · ผ่าน {result.valid} · ต้องแก้ไข {result.invalid}</p>{errors.slice(0, 10).map((error, index) => <small key={error.row + error.code + index}>แถว {error.row || "-"}{error.field ? " · " + error.field : ""}: {error.message}</small>)}{result.previewOnly && <button className="button secondary wide" onClick={commit} disabled={status === "committing"}>{status === "committing" ? <><LoaderCircle className="spin" size={18} />กำลังบันทึก…</> : "ยืนยันนำเข้า"}</button>}</div></div>}
    </section>
    <aside className="panel format-guide"><h2>หัวคอลัมน์</h2>{kind === "appointments" ? <dl><div><dt>hn</dt><dd>เลขประจำตัวผู้ป่วย</dd></div><div><dt>full_name</dt><dd>ชื่อและนามสกุล</dd></div><div><dt>appointment_date</dt><dd>วันที่นัด YYYY-MM-DD</dd></div><div><dt>clinic</dt><dd>ชื่อคลินิก</dd></div></dl> : <dl><div><dt>hn</dt><dd>เลขประจำตัวผู้ป่วย</dd></div><div><dt>service_date</dt><dd>วันที่มารับบริการ</dd></div><div><dt>clinic</dt><dd>ชื่อคลินิก</dd></div><div><dt>service_result</dt><dd>ผลการรับบริการ</dd></div></dl>}<p>{kind === "appointments" ? "เพิ่มได้: phone, village, appointment_time, service_result" : "service_date ใช้ appointment_date แทนได้"}</p><a className="text-link" href="/sample-appointments.csv" download>ดาวน์โหลดไฟล์ตัวอย่าง →</a></aside>
  </div>;
}
