"use client";

import { CheckCircle2, FileSpreadsheet, LoaderCircle, UploadCloud, XCircle } from "lucide-react";
import { useRef, useState } from "react";

type ImportResult = { ok: boolean; rows: number; valid: number; invalid: number; errors?: string[] };

export function ImportWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<ImportResult | null>(null);

  async function upload() {
    if (!file) return;
    setStatus("loading");
    const body = new FormData(); body.append("file", file);
    try {
      const response = await fetch("/api/import", { method: "POST", body });
      const data = await response.json();
      setResult(data); setStatus(response.ok ? "success" : "error");
    } catch {
      setResult({ ok: false, rows: 0, valid: 0, invalid: 0, errors: ["เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่"] });
      setStatus("error");
    }
  }

  return <div className="import-layout">
    <section className="panel upload-panel"><button className={`drop-zone ${file ? "has-file" : ""}`} onClick={() => inputRef.current?.click()} type="button">
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { const next = e.target.files?.[0] ?? null; setFile(next); setStatus("idle"); setResult(null); }} />
      {file ? <><FileSpreadsheet size={40} /><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(1)} KB · กดเพื่อเปลี่ยนไฟล์</span></> : <><UploadCloud size={44} /><strong>เลือกไฟล์ หรือลากมาวาง</strong><span>.xlsx, .xls หรือ .csv ขนาดไม่เกิน 10 MB</span></>}
    </button>
      <button className={`button primary wide ${status}`} onClick={upload} disabled={!file || status === "loading"}>{status === "loading" ? <><LoaderCircle className="spin" size={18} />กำลังตรวจข้อมูล…</> : "ตรวจสอบและนำเข้า"}</button>
      {result && <div className={`import-result ${status}`} role="status">{status === "success" ? <CheckCircle2 /> : <XCircle />}<div><strong>{status === "success" ? "ตรวจข้อมูลเรียบร้อย" : "ยังนำเข้าไม่ได้"}</strong><p>ทั้งหมด {result.rows} แถว · พร้อมนำเข้า {result.valid} · ต้องแก้ไข {result.invalid}</p>{result.errors?.map(error => <small key={error}>{error}</small>)}</div></div>}
    </section>
    <aside className="panel format-guide"><h2>หัวคอลัมน์ที่ต้องมี</h2><dl><div><dt>hn</dt><dd>เลขประจำตัวผู้ป่วย</dd></div><div><dt>full_name</dt><dd>ชื่อและนามสกุล</dd></div><div><dt>appointment_date</dt><dd>วันที่นัด YYYY-MM-DD</dd></div><div><dt>clinic</dt><dd>ชื่อคลินิก</dd></div></dl><p>เพิ่มได้: phone, village, appointment_time, service_result</p><a className="text-link" href="/sample-appointments.csv" download>ดาวน์โหลดไฟล์ตัวอย่าง →</a></aside>
  </div>;
}
