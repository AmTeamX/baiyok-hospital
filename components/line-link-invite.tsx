"use client";

import QRCode from "qrcode";
import { Check, Copy, LoaderCircle, QrCode } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/modal";

type Props = {
  targetType: "patient" | "profile";
  targetId: string;
  role: "patient" | "volunteer";
  label?: string;
};

export function LineLinkInvite({ targetType, targetId, role, label }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ code: string; qr: string } | null>(null);

  function close() {
    if (loading) return;
    setOpen(false);
    setResult(null);
    setError("");
    setCopied(false);
  }

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/line/link-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType, targetId, intendedRole: role })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error === "already_linked" ? "บัญชีนี้เชื่อม LINE แล้ว กรุณารีเฟรชหน้าเพื่อดูสถานะล่าสุด" : body.error ?? "สร้างรหัสไม่สำเร็จ");
      const token = String(body.token ?? "");
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
      const url = liffId ? `https://liff.line.me/${liffId}?code=${encodeURIComponent(token)}` : `${window.location.origin}/liff/link?code=${encodeURIComponent(token)}`;
      const qr = await QRCode.toDataURL(url, { width: 320, margin: 1 });
      setResult({ code: token, qr });
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "สร้างรหัสไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกรหัสแล้วคัดลอกด้วยตนเอง");
    }
  }

  return (
    <>
      <button type="button" className="button secondary" onClick={() => setOpen(true)} disabled={!targetId}><QrCode size={16} />{label ?? "สร้างรหัสเชื่อม LINE"}</button>
      <Modal open={open} onClose={close} title={result ? "รหัสเชื่อม LINE พร้อมใช้" : "สร้างรหัสเชื่อม LINE"} description={result ? "ให้ผู้ใช้สแกน QR หรือกรอกรหัสในเมนูผูกบัญชี" : "รหัสใหม่ใช้ได้ครั้งเดียวและหมดอายุใน 15 นาที"} size="sm">
        {result ? (
          <div className="line-modal-result">
            <img src={result.qr} alt="QR เปิดหน้าผูกบัญชี LINE" width={200} height={200} />
            <div className="line-code-block"><span>รหัสใช้ครั้งเดียว</span><strong>{result.code}</strong></div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => void copy()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "คัดลอกแล้ว" : "คัดลอกรหัส"}</button>
              <button type="button" className="button primary" onClick={close}>เสร็จสิ้น</button>
            </div>
          </div>
        ) : (
          <div className="modal-confirm">
            <div className="modal-callout"><QrCode size={20} /><p>การสร้างรหัสใหม่จะทำให้รหัสเดิมที่ยังไม่ได้ใช้ไม่ควรถูกนำไปแจกต่อ</p></div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={close} disabled={loading}>ยกเลิก</button>
              <button type="button" className="button primary" onClick={() => void generate()} disabled={loading} autoFocus>{loading ? <><LoaderCircle className="spin" size={16} />กำลังสร้าง</> : "สร้างรหัส"}</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
