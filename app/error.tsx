"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Unexpected application error", error); }, [error]);
  return <main className="login-page"><section className="login-card"><div className="login-copy"><p className="eyebrow">รพ.สต. สระโคล่</p><h1>เกิดข้อผิดพลาด</h1><p>ระบบไม่สามารถแสดงหน้านี้ได้ กรุณาลองใหม่อีกครั้ง</p></div><button className="button primary wide" onClick={() => reset()}>ลองใหม่</button></section></main>;
}
