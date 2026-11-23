import { Suspense } from "react";
import { CaseDetail } from "@/components/case-detail";

export default async function FollowUpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="page-shell"><div className="state-banner" role="status">กำลังโหลด…</div></div>}>
      <CaseDetail id={id} />
    </Suspense>
  );
}
