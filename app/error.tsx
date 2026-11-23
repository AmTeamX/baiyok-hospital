"use client";

import { useEffect } from "react";
import { StatusScreen } from "@/components/status-screen";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Unexpected application error", error); }, [error]);
  return <StatusScreen title="เปิดหน้านี้ไม่สำเร็จ" description="ระบบไม่สามารถโหลดข้อมูลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง"><button className="button primary" onClick={() => reset()}>ลองใหม่</button></StatusScreen>;
}
