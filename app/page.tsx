import Link from "next/link";
import { ArrowUpRight, CheckCircle2, CircleAlert, Clock3, UserRoundCheck } from "lucide-react";
import { getDashboardData } from "@/lib/data";

export default async function DashboardPage() {
  const { mode, stats, patients } = await getDashboardData();
  const today = new Intl.DateTimeFormat("th-TH", { dateStyle: "full", timeZone: "Asia/Bangkok" }).format(new Date());
  return <div className="page-shell">
    <div className="page-heading"><div><p className="eyebrow">{today}</p><h1>ศูนย์งานติดตามผู้ป่วย</h1><p>เริ่มจากงานเร่งด่วน ตรวจความคืบหน้า และไปยังงานประจำวันได้จากจุดเดียว</p></div><Link className="button primary" href="/patients/import">นำเข้ารายการนัด</Link></div>
    {mode === "demo" && <div className="demo-banner"><CircleAlert size={18} /><span><strong>โหมดสาธิต</strong> ระบบจะแสดงข้อมูลตัวอย่างจนกว่าจะเชื่อม Supabase</span></div>}
    <section className="stats-grid" aria-label="สถิติการติดตาม">
      {stats.map((stat) => <article className={`stat-card tone-${stat.tone}`} key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.helper}</small></article>)}
    </section>
    <div className="dashboard-grid">
      <section className="panel priority-panel"><div className="panel-head"><div><h2>ต้องทำวันนี้</h2><p>เรียงตามความเร่งด่วน</p></div><Link href="/missed">ดูทั้งหมด <ArrowUpRight size={16} /></Link></div>
        <div className="task-list">
          {patients.slice(0, 3).map((patient, index) => <Link className="task-row" href={`/follow-up/${patient.id}`} key={patient.id}><span className={`task-rank rank-${index + 1}`}>{index + 1}</span><span className="task-person"><strong>{patient.name}</strong><small>HN {patient.hn} · {patient.village}</small></span><span className="late-badge">เลยนัด {patient.daysLate} วัน</span><ArrowUpRight size={17} /></Link>)}
        </div>
      </section>
      <section className="panel flow-panel"><div className="panel-head"><div><h2>เส้นทางการติดตาม</h2><p>จากขาดนัดถึงกลับมารับบริการ</p></div></div>
        <div className="flow-step done"><span><CircleAlert /></span><div><strong>พบผู้ขาดนัด</strong><small>{stats[0]?.value ?? "—"} ราย</small></div></div>
        <div className="flow-line" />
        <div className="flow-step current"><span><Clock3 /></span><div><strong>ติดตามแล้ว</strong><small>{stats[1]?.value ?? "—"} ราย</small></div></div>
        <div className="flow-line" />
        <div className="flow-step"><span><UserRoundCheck /></span><div><strong>นัดใหม่</strong><small>{stats[2]?.value ?? "—"} ราย</small></div></div>
        <div className="flow-line" />
        <div className="flow-step"><span><CheckCircle2 /></span><div><strong>กลับมาจริง</strong><small>{stats[3]?.value ?? "—"} ราย</small></div></div>
      </section>
    </div>
  </div>;
}
