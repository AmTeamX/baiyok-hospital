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
