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
  const [result, setResult] = useState<{ url: string; qr: string } | null>(null);

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
      const url = `${window.location.origin}/liff/link?code=${encodeURIComponent(body.token)}&role=${role}`;
      const qr = await QRCode.toDataURL(url, { width: 320, margin: 1 });
      setResult({ url, qr });
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "สร้างรหัสไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
    } catch {
      // Clipboard may be unavailable; the link is still shown in the QR.
    }
  }

  if (result) {
    return (
      <div className="link-invite-result">
        <img src={result.qr} alt="QR เชื่อมบัญชี LINE" width={180} height={180} />
        <p>ให้ผู้ใช้สแกน QR นี้ในแอป LINE — ใช้ได้ครั้งเดียว หมดอายุใน 15 นาที</p>
        <div className="link-invite-actions">
          <button className="button secondary" onClick={() => void copy()}><Copy size={15} /> คัดลอกลิงก์</button>
          <button className="button secondary" onClick={() => setResult(null)}><X size={15} /> ปิด</button>
        </div>
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
