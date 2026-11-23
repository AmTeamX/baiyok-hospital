import { Suspense } from "react";
import { MissedRegistry } from "@/components/missed-registry";

export default function MissedPage() {
  return (
    <Suspense fallback={<div className="page-shell"><div className="state-banner" role="status">กำลังโหลด…</div></div>}>
      <MissedRegistry />
    </Suspense>
  );
}
