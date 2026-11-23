import { Suspense } from "react";
import { CreateCase } from "@/components/create-case";

export default function NewCasePage() {
  return <div className="page-shell"><Suspense fallback={<p role="status">กำลังเตรียมข้อมูล…</p>}><CreateCase /></Suspense></div>;
}
