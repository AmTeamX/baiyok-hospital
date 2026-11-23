type Liff = {
  init: (config: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  isInClient: () => boolean;
  login: () => void;
  getIDToken: () => string | null;
};

declare global {
  interface Window {
    liff?: Liff;
  }
}

let liffPromise: Promise<Liff> | null = null;
export type LiffAccountContext = { linkId: string; role: "patient" | "volunteer" };
let sessionPromise: Promise<LiffAccountContext[]> | null = null;

export class LiffSessionError extends Error {
  constructor(public code: string) {
    const messages: Record<string, string> = {
      account_not_linked: "บัญชี LINE นี้ยังไม่ได้เชื่อมกับหน่วยบริการ",
      session_not_configured: "ระบบยืนยันตัวตนยังไม่พร้อม กรุณาแจ้งเจ้าหน้าที่",
      database_required: "ระบบข้อมูลยังไม่พร้อม กรุณาลองใหม่ภายหลัง",
      query_failed: "โหลดบัญชีไม่สำเร็จ กรุณาลองใหม่",
      invalid_audience: "LIFF กับ LINE Login channel ไม่ตรงกัน กรุณาแจ้งเจ้าหน้าที่",
      invalid_nonce: "การยืนยันตัวตนหมดอายุ กรุณาลองใหม่",
      expired: "การเข้าสู่ระบบ LINE หมดอายุ กรุณาเปิดเมนูใหม่"
    };
    super(messages[code] ?? "ยืนยันตัวตน LINE ไม่สำเร็จ กรุณาลองใหม่");
  }
}

/** Re-open an already linked account without consuming another linking code. */
export function restoreLiffSession(): Promise<LiffAccountContext[]> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const init = await fetch("/api/line/liff/init", { cache: "no-store" }).then((response) => response.json());
      if (!init.ok) throw new LiffSessionError(init.error);
      const idToken = await getLiffIdToken(init.liffId);
      const response = await fetch("/api/line/me/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken, nonce: init.nonce }) });
      const body = await response.json();
      if (!response.ok) throw new LiffSessionError(body.error);
      return (body.contexts ?? []) as LiffAccountContext[];
    })().finally(() => { sessionPromise = null; });
  }
  return sessionPromise;
}

function loadLiffSdk(): Promise<Liff> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.liff) return Promise.resolve(window.liff);
  if (!liffPromise) {
    liffPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
      script.charset = "utf-8";
      script.onload = () => resolve(window.liff as Liff);
      script.onerror = () => reject(new Error("โหลด LIFF SDK ไม่สำเร็จ"));
      document.head.appendChild(script);
    });
  }
  return liffPromise;
}

/** Load the LIFF SDK, initialize it, and return the verified ID token. */
export async function getLiffIdToken(liffId: string): Promise<string> {
  const liff = await loadLiffSdk();
  await liff.init({ liffId });
  if (!liff.isInClient()) {
    throw new Error("กรุณาเปิดหน้านี้จากแอป LINE");
  }
  if (!liff.isLoggedIn()) {
    liff.login();
    throw new Error("กำลังเข้าสู่ระบบ LINE…");
  }
  const idToken = liff.getIDToken();
  if (!idToken) throw new Error("ไม่สามารถยืนยันตัวตนได้");
  return idToken;
}
