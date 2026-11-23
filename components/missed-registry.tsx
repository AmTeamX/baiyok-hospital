"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, CircleAlert, LoaderCircle, RotateCcw, Search } from "lucide-react";
import { DEFAULT_PAGE_SIZE, MISSED_PRIORITIES, parseMissedQuery, type MissedFilters, type MissedRow, type MissedStatus, type VolunteerOption } from "@/lib/missed";
import { PatientTabs } from "@/components/patient-tabs";

type RegistryResponse = {
  ok: boolean;
  mode?: "demo" | "database";
  rows: MissedRow[];
  total: number;
  page: number;
  pageSize: number;
  volunteers: VolunteerOption[];
  areas: string[];
  error?: string;
};

const STATUS_OPTIONS: { value: MissedStatus; label: string }[] = [
  { value: "pending", label: "รอติดตาม" },
  { value: "assigned", label: "กำลังติดตาม" },
  { value: "contacted", label: "กำลังติดตาม (ติดต่อแล้ว)" },
  { value: "rescheduled", label: "นัดใหม่แล้ว" },
  { value: "returned", label: "กลับมารับบริการ" },
  { value: "closed", label: "ปิดเคส" }
];

const PRIORITY_LABEL: Record<string, string> = { normal: "ปกติ", high: "สูง", urgent: "ด่วน" };

function statusLabel(status: MissedStatus): string {
  if (status === "returned" || status === "closed") return "กลับมารับบริการ";
  if (status === "rescheduled") return "นัดใหม่แล้ว";
  if (status === "assigned" || status === "contacted") return "กำลังติดตาม";
  return "รอติดตาม";
}

function thaiDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(date);
}

function buildParams(filters: MissedFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.area) params.set("area", filters.area);
  if (filters.assignee) params.set("assignee", filters.assignee);
  if (filters.unassignedOnly) params.set("unassigned", "1");
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.page > 1) params.set("page", String(filters.page));
  if (filters.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(filters.pageSize));
  if (filters.sort !== "appointment_at") params.set("sort", filters.sort);
  if (filters.order !== "asc") params.set("order", filters.order);
  return params;
}

export function MissedRegistry() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = searchParams.toString();
  const urlFilters = useMemo(() => parseMissedQuery(new URLSearchParams(key)), [key]);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [data, setData] = useState<RegistryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(key);
      if (debouncedQ) params.set("q", debouncedQ);
      const response = await fetch(`/api/missed?${params.toString()}`);
      const json = (await response.json()) as RegistryResponse;
      if (!response.ok) {
        setError(json.error ?? "โหลดข้อมูลไม่สำเร็จ");
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [key, debouncedQ]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function updateFilters(patch: Partial<MissedFilters>) {
    const hasPage = "page" in patch;
    const next: MissedFilters = { ...urlFilters, ...patch, page: hasPage ? (patch.page as number) : 1 };
    const query = buildParams(next).toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const page = urlFilters.page;
  const pageSize = urlFilters.pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ทะเบียนติดตาม</p>
          <h1>ผู้ป่วยขาดนัด</h1>
          <p>ค้นหา มอบหมาย อสม. และติดตามผลจนยืนยันกลับมารับบริการ</p>
        </div>
        <span className="muted-count">{loading ? "กำลังโหลด…" : `${total} ราย`}</span>
      </div>

      <PatientTabs />

      <section className="panel table-panel missed-panel">
        <details className="filter-disclosure" open={Boolean(urlFilters.status || urlFilters.area || urlFilters.assignee || urlFilters.priority || urlFilters.from || urlFilters.to || urlFilters.unassignedOnly)}>
          <summary>ค้นหาและกรองผู้ขาดนัด <span>สถานะ · พื้นที่ · ผู้รับผิดชอบ</span></summary>
        <div className="registry-filters">
          <label className="field">
            <span>ค้นหา</span>
            <div className="search-field">
              <Search size={17} />
              <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="ชื่อ, HN หรือหมู่บ้าน" aria-label="คำค้นหา" />
            </div>
          </label>
          <label className="field">
            <span>สถานะ</span>
            <select value={urlFilters.status ?? ""} onChange={(event) => updateFilters({ status: (event.target.value || null) as MissedStatus | null })}>
              <option value="">ทุกสถานะ</option>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>พื้นที่</span>
            <select value={urlFilters.area ?? ""} onChange={(event) => updateFilters({ area: event.target.value || null })}>
              <option value="">ทุกพื้นที่</option>
              {(data?.areas ?? []).map((area) => <option key={area} value={area}>{area}</option>)}
            </select>
          </label>
          <label className="field">
            <span>ผู้รับผิดชอบ</span>
            <select value={urlFilters.assignee ?? ""} onChange={(event) => updateFilters({ assignee: event.target.value || null, unassignedOnly: false })}>
              <option value="">ทั้งหมด</option>
              {(data?.volunteers ?? []).map((volunteer) => <option key={volunteer.id} value={volunteer.id}>{volunteer.fullName}</option>)}
            </select>
          </label>
          <label className="field">
            <span>ความเร่งด่วน</span>
            <select value={urlFilters.priority ?? ""} onChange={(event) => updateFilters({ priority: (event.target.value || null) as MissedFilters["priority"] })}>
              <option value="">ทั้งหมด</option>
              {MISSED_PRIORITIES.map((priority) => <option key={priority} value={priority}>{PRIORITY_LABEL[priority]}</option>)}
            </select>
          </label>
          <label className="field">
            <span>วันที่นัด (จาก)</span>
            <input type="date" value={urlFilters.from ?? ""} onChange={(event) => updateFilters({ from: event.target.value || null })} />
          </label>
          <label className="field">
            <span>ถึง</span>
            <input type="date" value={urlFilters.to ?? ""} onChange={(event) => updateFilters({ to: event.target.value || null })} />
          </label>
          <label className="inline-filter">
            <input type="checkbox" checked={urlFilters.unassignedOnly} onChange={(event) => updateFilters({ unassignedOnly: event.target.checked })} />
            <span>เฉพาะยังไม่มอบหมาย</span>
          </label>
        </div>

        <div className="table-tools">
          <label className="field">
            <span>เรียงตาม</span>
            <select value={urlFilters.sort} onChange={(event) => updateFilters({ sort: event.target.value as MissedFilters["sort"] })}>
              <option value="appointment_at">วันนัดเดิม</option>
              <option value="days_late">จำนวนวันที่เลยนัด</option>
              <option value="priority">ความเร่งด่วน</option>
              <option value="full_name">ชื่อผู้ป่วย</option>
            </select>
          </label>
          <label className="field">
            <span>ทิศทาง</span>
            <select value={urlFilters.order} onChange={(event) => updateFilters({ order: event.target.value as "asc" | "desc" })}>
              <option value="asc">น้อยไปมาก</option>
              <option value="desc">มากไปน้อย</option>
            </select>
          </label>
        </div>

        </details>
        {error && (
          <div className="state-banner error" role="alert">
            <CircleAlert size={18} />
            <span>{error}</span>
            <button className="button secondary" onClick={() => void fetchData()}>ลองใหม่</button>
          </div>
        )}

        {loading && (
          <div className="state-banner" role="status">
            <LoaderCircle className="spin" size={18} />
            <span>กำลังโหลดข้อมูล…</span>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="state-banner empty">
            <Search size={18} />
            <span>ไม่พบรายการที่ตรงกับเงื่อนไข</span>
            <button className="button secondary" onClick={() => { setQ(""); router.replace(pathname, { scroll: false }); }}><RotateCcw size={16} />ล้างตัวกรอง</button>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="patient-table">
            <div className="table-row table-header">
              <span>ผู้ป่วย</span><span>วันนัดเดิม</span><span>เหตุผล</span><span>ผู้รับผิดชอบ</span><span>สถานะ</span><span />
            </div>
            {rows.map((row) => (
              <div className="table-row" key={row.id}>
                <span data-label="ผู้ป่วย">
                  <strong>{row.fullName}</strong>
                  <small>HN {row.hn}{row.age ? ` · อายุ ${row.age} ปี` : ""}{row.village ? ` · ${row.village}` : ""}</small>
                </span>
                <span data-label="วันนัดเดิม">{thaiDate(row.appointmentAt)}<small>เลยนัด {row.daysLate} วัน</small></span>
                <span data-label="เหตุผล">{row.missedReason ?? "รอประเมิน"}</span>
                <span data-label="ผู้รับผิดชอบ">{row.assigneeName ?? "ยังไม่มอบหมาย"}</span>
                <span data-label="สถานะ">
                  <i className={`status-dot status-${statusLabel(row.status)}`}>
                    {statusLabel(row.status)}{row.overdue ? " · เลยกำหนด" : ""}
                  </i>
                </span>
                <Link aria-label={`เปิดเคส ${row.fullName}`} href={`/follow-up/${row.id}`}><ArrowUpRight size={18} /></Link>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && total > 0 && (
          <div className="pagination">
            <button className="icon-button" onClick={() => updateFilters({ page: Math.max(1, page - 1) })} disabled={page <= 1} aria-label="หน้าก่อนหน้า"><ChevronLeft size={18} /></button>
            <span>หน้า {page} / {totalPages}</span>
            <button className="icon-button" onClick={() => updateFilters({ page: Math.min(totalPages, page + 1) })} disabled={page >= totalPages} aria-label="หน้าถัดไป"><ChevronRight size={18} /></button>
          </div>
        )}
      </section>
    </div>
  );
}
