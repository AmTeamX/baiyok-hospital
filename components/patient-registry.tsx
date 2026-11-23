"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, MapPin, Phone, RotateCcw, Search, UserRound } from "lucide-react";

type PatientRow = {
  id: string;
  hn: string;
  fullName: string;
  phone: string | null;
  village: string | null;
  birthDate: string | null;
  appointmentCount: number;
  latestAppointment: { appointmentAt: string; clinic: string; status: string } | null;
};

type View = "all" | "active" | "missed" | "none";

const STATUS_LABEL: Record<string, string> = { scheduled: "นัดปกติ", missed: "ขาดนัด", attended: "มาแล้ว", rescheduled: "นัดใหม่", cancelled: "ยกเลิก" };
const filters: Array<{ value: View; label: string }> = [
  { value: "all", label: "ทั้งหมด" }, { value: "active", label: "มีนัด" }, { value: "missed", label: "ขาดนัด" }, { value: "none", label: "ยังไม่มีนัด" }
];

function thaiDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(date);
}

export function PatientRegistry() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [view, setView] = useState<View>("all");
  const queryParam = searchParams.get("q")?.trim() ?? "";
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (queryParam) params.set("q", queryParam);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      const response = await fetch(`/api/patients?${params.toString()}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "โหลดรายชื่อผู้ป่วยไม่สำเร็จ");
      setRows(body.patients ?? []);
      setTotal(body.total ?? 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดรายชื่อผู้ป่วยไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [page, queryParam]);

  useEffect(() => { void load(); }, [load]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (view === "active") return Boolean(row.latestAppointment && row.latestAppointment.status !== "missed");
    if (view === "missed") return row.latestAppointment?.status === "missed";
    if (view === "none") return !row.latestAppointment;
    return true;
  }), [rows, view]);

  function navigate(nextPage: number, query = q) {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (nextPage > 1) params.set("page", String(nextPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <section className="patient-workspace" aria-label="ทะเบียนผู้ป่วย">
      <div className="patient-registry-head">
        <div><span className="registry-kicker">ทะเบียนทั้งหมด</span><strong>{loading ? "—" : total.toLocaleString("th-TH")} ราย</strong><small>แสดงครั้งละ {pageSize} ราย</small></div>
        <form className="patient-search" onSubmit={(event) => { event.preventDefault(); navigate(1); }} role="search">
          <Search size={19} />
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="ค้นหาด้วยชื่อ, HN หรือหมู่บ้าน" aria-label="ค้นหาผู้ป่วย" />
          {q && <button type="button" className="search-clear" onClick={() => { setQ(""); navigate(1, ""); }}>ล้าง</button>}
          <button className="button primary">ค้นหา</button>
        </form>
      </div>

      <div className="patient-filterbar">
        <div className="patient-filterset" aria-label="กรองรายการในหน้านี้">{filters.map((filter) => <button key={filter.value} type="button" aria-pressed={view === filter.value} onClick={() => setView(filter.value)}>{filter.label}</button>)}</div>
        <span>ตัวกรองใช้กับ {rows.length} รายในหน้าปัจจุบัน</span>
      </div>

      {error && <div className="state-banner error"><CircleAlert size={18} /><span><strong>โหลดทะเบียนไม่สำเร็จ</strong> {error}</span><button className="button secondary" onClick={() => void load()}><RotateCcw size={16} />ลองใหม่</button></div>}

      <div className="patient-list" aria-busy={loading}>
        <div className="patient-list-header" aria-hidden="true"><span>ผู้ป่วย</span><span>ช่องทางติดต่อ</span><span>นัดล่าสุด</span><span>สถานะ</span><span /></div>
        {loading ? Array.from({ length: 5 }, (_, index) => <div className="patient-row-skeleton" key={index}><span /><span /><span /></div>) : filteredRows.length === 0 ? (
          <div className="patient-empty"><UserRound size={28} /><strong>{rows.length === 0 ? "ไม่พบผู้ป่วย" : "ไม่มีผู้ป่วยในกลุ่มนี้"}</strong><p>{rows.length === 0 ? "ลองค้นหาด้วยชื่อ HN หรือหมู่บ้านอื่น" : "เลือกตัวกรองอื่นเพื่อดูรายการในหน้าปัจจุบัน"}</p></div>
        ) : filteredRows.map((row) => {
          const status = row.latestAppointment?.status;
          return (
            <article className="patient-registry-row" key={row.id}>
              <div className="patient-identity"><span className="patient-initial" aria-hidden="true">{row.fullName.slice(0, 1)}</span><span><Link href={`/patients/${row.id}`}>{row.fullName}</Link><small>HN {row.hn} · {row.appointmentCount} นัด</small></span></div>
              <div className="patient-contact"><span><MapPin size={15} />{row.village ?? "ไม่ระบุหมู่บ้าน"}</span><span><Phone size={15} />{row.phone ?? "ไม่ระบุเบอร์โทร"}</span></div>
              <div className="patient-latest">{row.latestAppointment ? <><strong><CalendarDays size={16} />{thaiDate(row.latestAppointment.appointmentAt)}</strong><small>{row.latestAppointment.clinic}</small></> : <><strong>ยังไม่มีนัด</strong><small>เพิ่มนัดจากหน้ารายละเอียด</small></>}</div>
              <div><i className={`status-dot status-${status ?? "none"}`}>{status ? STATUS_LABEL[status] ?? status : "ไม่มีนัด"}</i></div>
              <Link className="patient-open" href={`/patients/${row.id}`}>เปิดประวัติ<ChevronRight size={16} /></Link>
            </article>
          );
        })}
      </div>

      <div className="registry-footer"><span>หน้า {page} จาก {totalPages} · ทั้งหมด {total.toLocaleString("th-TH")} ราย</span><div><button className="button secondary" onClick={() => navigate(page - 1)} disabled={page <= 1}><ChevronLeft size={17} />ก่อนหน้า</button><button className="button secondary" onClick={() => navigate(page + 1)} disabled={page >= totalPages}>ถัดไป<ChevronRight size={17} /></button></div></div>
    </section>
  );
}
