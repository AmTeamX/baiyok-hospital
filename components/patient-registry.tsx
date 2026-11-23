"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CircleAlert, LoaderCircle, RotateCcw, Search, UserPlus } from "lucide-react";

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

const STATUS_LABEL: Record<string, string> = {
  scheduled: "นัดปกติ",
  missed: "ขาดนัด",
  attended: "มาแล้ว",
  rescheduled: "นัดใหม่",
  cancelled: "ยกเลิก"
};

function thaiDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(date);
}

export function PatientRegistry() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
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
      if (q.trim()) params.set("q", q.trim());
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
  }, [q, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    if (q.trim()) params.set("q", q.trim());
    else params.delete("q");
    router.push(`${pathname}?${params.toString()}`);
  }

  function search() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <>
      <div className="table-tools">
        <div className="search-field">
          <Search size={17} />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") search(); }}
            placeholder="ค้นหา HN, ชื่อ หรือหมู่บ้าน"
            aria-label="ค้นหาผู้ป่วย"
          />
        </div>
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <button className="button secondary" onClick={search}>ค้นหา</button>
          <Link className="button primary" href="/patients/add"><UserPlus size={17} /> เพิ่มผู้ป่วย</Link>
        </div>
      </div>

      {error && <div className="demo-banner"><CircleAlert size={18} /><span><strong>เกิดข้อผิดพลาด</strong> {error}</span><button className="button secondary" onClick={() => void load()}><RotateCcw size={16} />ลองใหม่</button></div>}

      <section className="panel table-panel">
        <div className="patient-table">
          <div className="table-row table-header"><span>ผู้ป่วย</span><span>หมู่บ้าน</span><span>นัดล่าสุด</span><span>จำนวนนัด</span><span /></div>
          {loading ? (
            <div className="empty-state"><strong>กำลังโหลด</strong></div>
          ) : rows.length === 0 ? (
            <div className="empty-state"><strong>ไม่พบผู้ป่วย</strong><p>ลองค้นหาด้วยคำอื่น หรือเพิ่มผู้ป่วยใหม่</p></div>
          ) : (
            rows.map((row) => (
              <div className="table-row" key={row.id}>
                <span data-label="ผู้ป่วย"><strong>{row.fullName}</strong><small>HN {row.hn}</small></span>
                <span data-label="หมู่บ้าน">{row.village ?? "—"}</span>
                <span data-label="นัดล่าสุด">
                  {row.latestAppointment ? (
                    <><strong>{row.latestAppointment.clinic} · {thaiDate(row.latestAppointment.appointmentAt)}</strong><small>{STATUS_LABEL[row.latestAppointment.status] ?? row.latestAppointment.status}</small></>
                  ) : <small>ยังไม่มีนัด</small>}
                </span>
                <span data-label="จำนวนนัด">{row.appointmentCount}</span>
                <Link href={`/patients/${row.id}`} aria-label={`ดูรายละเอียด ${row.fullName}`}>›</Link>
              </div>
            ))
          )}
        </div>
      </section>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="icon-button" onClick={() => goToPage(page - 1)} disabled={page <= 1} aria-label="หน้าก่อนหน้า"><ChevronLeft /></button>
          <span>หน้า {page} / {totalPages} · {total} ราย</span>
          <button className="icon-button" onClick={() => goToPage(page + 1)} disabled={page >= totalPages} aria-label="หน้าถัดไป"><ChevronRight /></button>
        </div>
      )}
    </>
  );
}
