import { requireClinicalStaff } from "@/lib/supabase/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";

export default async function ImportBatchesPage() {
  const staff = await requireClinicalStaff();
  const batches = staff && hasSupabaseAdmin() ? (await createAdminClient().from("import_batches").select("id, kind, filename, status, total_rows, valid_rows, invalid_rows, created_at, committed_at").order("created_at", { ascending: false }).limit(100)).data ?? [] : [];
  return <div className="page-shell"><div className="page-heading"><div><p className="eyebrow">ประวัติการนำเข้า</p><h1>ชุดข้อมูลที่นำเข้า</h1><p>ตรวจสอบไฟล์ ผู้บันทึกผล และสถานะการนำเข้าย้อนหลัง</p></div></div><section className="panel table-panel"><div className="patient-table"><div className="table-row table-header"><span>ไฟล์</span><span>ชนิด</span><span>แถวทั้งหมด</span><span>ผ่าน</span><span>ผิดพลาด</span><span>สถานะ</span></div>{batches.length ? batches.map((batch) => <div className="table-row" key={batch.id}><span data-label="ไฟล์"><strong>{batch.filename}</strong><small>{new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(batch.created_at))}</small></span><span data-label="ชนิด">{batch.kind === "appointments" ? "รายการนัด" : "ผลบริการ"}</span><span data-label="แถวทั้งหมด">{batch.total_rows}</span><span data-label="ผ่าน">{batch.valid_rows}</span><span data-label="ผิดพลาด">{batch.invalid_rows}</span><span data-label="สถานะ"><i className={"status-dot status-" + batch.status}>{batch.status}</i></span></div>) : <div className="empty-state"><strong>ยังไม่มีประวัติการนำเข้า</strong><p>เมื่อยืนยันไฟล์แล้ว รายการจะแสดงที่นี่</p></div>}</div></section></div>;
}

