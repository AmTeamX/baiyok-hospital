"use client";

import QRCode from "qrcode";
import { Copy, LoaderCircle, QrCode, X } from "lucide-react";
import { useState } from "react";

type Props = {
  targetType: "patient" | "profile";
  targetId: string;
  role: "patient" | "volunteer";
  label?: string;
};

/**
 * Staff-facing "สร้างรหัสเชื่อม LINE" button. Calls the one-time link-code API,
 * then renders a QR + link the patient/volunteer can open inside LINE. The code
 * is single-use and expires after 15 minutes.
 */
export function LineLinkInvite({ targetType, targetId, role, label }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ code: string; url: string; qr: string } | null>(null);

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
      if (!response.ok) throw new Error(body.error ?? "สร้างรหัสไม่สำเร็จ");
      const token = String(body.token ?? "");
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
      const url = liffId
        ? `https://liff.line.me/${liffId}?code=${encodeURIComponent(token)}`
        : `${window.location.origin}/liff/link?code=${encodeURIComponent(token)}`;
      const qr = await QRCode.toDataURL(url, { width: 320, margin: 1 });
      setResult({ code: token, url, qr });
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
    } catch {
      // Clipboard may be unavailable; the code is still shown on screen.
    }
  }

  if (result) {
    return (
      <div className="link-invite-result">
        <p>ให้ผู้ใช้เปิดเมนู "ผูกบัญชี" ใน LINE แล้วกรอกรหัสนี้</p>
        <div className="link-code-display">{result.code}</div>
        <div className="link-invite-actions">
          <button className="button secondary" onClick={() => void copy()}><Copy size={15} /> คัดลอกรหัส</button>
          <button className="button secondary" onClick={() => setResult(null)}><X size={15} /> ปิด</button>
        </div>
        {result.qr && (
          <>
            <p>หรือสแกน QR เพื่อเปิดหน้าผูกบัญชี (รหัสอาจถูกกรอกอัตโนมัติ)</p>
            <img src={result.qr} alt="QR เปิดหน้าผูกบัญชี LINE" width={160} height={160} />
          </>
        )}
        <p>ใช้ได้ครั้งเดียว หมดอายุใน 15 นาที</p>
      </div>
    );
  }

  return (
    <div>
      <button className="button secondary" onClick={() => void generate()} disabled={loading || !targetId}>
        {loading ? <LoaderCircle className="spin" size={16} /> : <QrCode size={16} />} {label ?? "สร้างรหัสเชื่อม LINE"}
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
