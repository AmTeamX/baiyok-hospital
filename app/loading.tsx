export default function Loading() {
  return (
    <div className="page-shell loading-shell" role="status" aria-label="กำลังโหลดหน้า">
      <div className="loading-heading"><span /><strong /></div>
      <div className="loading-grid"><span /><span /><span /></div>
      <span className="sr-only">กำลังโหลด…</span>
    </div>
  );
}
