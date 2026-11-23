import Link from "next/link";
import { ArrowUpRight, Filter } from "lucide-react";
import { getMissedPatients } from "@/lib/data";

export default async function MissedPage() {
  const { patients } = await getMissedPatients();
  return <div className="page-shell"><div className="page-heading"><div><p className="eyebrow">ทะเบียนติดตาม</p><h1>ผู้ป่วยขาดนัด</h1><p>ค้นหา มอบหมาย อสม. และติดตามผลจนยืนยันกลับมารับบริการ</p></div><button className="button secondary"><Filter size={17} />ตัวกรอง</button></div>
    <section className="panel table-panel"><div className="table-tools"><label><span>ค้นหา</span><input placeholder="ชื่อ, HN หรือหมู่บ้าน" /></label><label><span>สถานะ</span><select defaultValue="all"><option value="all">ทุกสถานะ</option><option>รอติดตาม</option><option>กำลังติดตาม</option><option>นัดใหม่แล้ว</option></select></label></div>
      <div className="patient-table"><div className="table-row table-header"><span>ผู้ป่วย</span><span>วันนัดเดิม</span><span>เหตุผล</span><span>ผู้รับผิดชอบ</span><span>สถานะ</span><span /></div>
      {patients.map(patient => <div className="table-row" key={patient.id}><span data-label="ผู้ป่วย"><strong>{patient.name}</strong><small>HN {patient.hn}{patient.age ? ` · อายุ ${patient.age} ปี` : ""}</small></span><span data-label="วันนัดเดิม">{patient.appointment}<small>เลยนัด {patient.daysLate} วัน</small></span><span data-label="เหตุผล">{patient.reason}</span><span data-label="ผู้รับผิดชอบ">{patient.assignee}</span><span data-label="สถานะ"><i className={`status-dot status-${patient.status}`}>{patient.status}</i></span><Link aria-label={`เปิดเคส ${patient.name}`} href={`/follow-up/${patient.id}`}><ArrowUpRight size={18} /></Link></div>)}
      </div>
    </section>
  </div>;
}
