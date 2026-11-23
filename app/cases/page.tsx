import { Suspense } from "react";
import { CaseRegistry } from "@/components/case-registry";

export default function CasesPage() {
  return <div className="page-shell"><Suspense fallback={<p role="status">กำลังโหลดรายการเคส…</p>}><CaseRegistry /></Suspense></div>;
}
