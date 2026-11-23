"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ClipboardList, Plus, Search } from "lucide-react";
import { CASE_STATUS_LABELS, CASE_PRIORITY_LABELS, CASE_LINE_LABELS, type CaseRow } from "@/lib/cases";

export function CaseRegistry() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.toString();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [data, setData] = useState<{ cases: CaseRow[]; total: number; mode: string } | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [volunteers, setVolunteers] = useState<{ id: string; full_name: string }[]>([]);
  const page = Math.max(1, Number(params.get("page")) || 1);
  useEffect(() => { setSearch(params.get("q") ?? ""); }, [params]);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError("");
    void fetch(`/api/cases?${query}`, { signal: controller.signal }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? "กรุณาเข้าสู่ระบบอีกครั้ง" : result.error);
      setData(result);
    }).catch((cause) => { if (!controller.signal.aborted) setError(cause.message || "โหลดรายการเคสไม่สำเร็จ"); });
    return () => controller.abort();
  }, [query, reload]);
  useEffect(() => { let active = true; void fetch("/api/volunteers").then((r) => r.json()).then((r) => { if (active && r.mode === "database") setVolunteers((r.volunteers ?? []).filter((v: { active: boolean }) => v.active)); }).catch(() => {}); return () => { active = false; }; }, []);
  function filter(key: string, value: string) {
    const next = new URLSearchParams(query); next.delete("page");
    if (value) next.set(key, value); else next.delete(key);
    router.push(`/cases?${next}`);
  }
  const date = (value: string) => new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
  return <>
    <div className="page-heading"><div><p className="eyebrow">Case management</p><h1>จัดการเคส</h1><p>มอบหมายงาน ติดตามผล และตรวจสถานะการแจ้งเตือน อสม. ในแต่ละเคส</p></div><Link href="/cases/new" className="button primary"><Plus size={18} />สร้างเคส</Link></div>
    <section className="panel case-register" aria-label="รายการเคสติดตาม">
      <div className="case-filters">
        <form onSubmit={(event) => { event.preventDefault(); filter("q", search.trim()); }} className="case-search"><label className="search-field"><Search size={18} /><input aria-label="ค้นหาชื่อผู้ป่วยหรือ HN" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ชื่อผู้ป่วย หรือ HN" /></label><button className="button secondary">ค้นหา</button></form>
        <label className="field">สถานะเคส<select value={params.get("status") ?? ""} onChange={(e) => filter("status", e.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(CASE_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="field">ผู้รับผิดชอบ<select value={params.get("assignee") ?? ""} onChange={(e) => filter("assignee", e.target.value)}><option value="">ทุกคน</option><option value="unassigned">ยังไม่มอบหมาย</option>{volunteers.map((v) => <option key={v.id} value={v.id}>{v.full_name}</option>)}</select></label>
      </div>
      {error ? <div className="case-empty" role="alert"><h2>โหลดเคสไม่สำเร็จ</h2><p>{error}</p><button className="button secondary" onClick={() => setReload((r) => r + 1)}>ลองใหม่</button></div> : !data ? <div className="case-empty" role="status">กำลังโหลดรายการเคส…</div> : <>
        <div className="case-list-meta"><strong>{data.total.toLocaleString("th-TH")} เคส</strong><span>เรียงตามการอัปเดตล่าสุด</span></div>
        {data.mode === "demo" && <div className="state-banner">โหมดสาธิต — เชื่อมต่อฐานข้อมูลเพื่อสร้างและจัดการเคสจริง</div>}
        {data.cases.length === 0 ? <div className="case-empty"><ClipboardList size={36} /><h2>{query ? "ไม่พบเคสตามตัวกรอง" : "ยังไม่มีเคสติดตาม"}</h2><p>{query ? "ลองเปลี่ยนคำค้นหรือเลือกสถานะอื่น" : "เลือกผู้ป่วยและนัดที่ต้องติดตาม เพื่อสร้างงานให้ อสม."}</p>{query ? <Link className="button secondary" href="/cases">ล้างตัวกรอง</Link> : <Link className="button primary" href="/cases/new">สร้างเคสแรก</Link>}</div> : <div className="case-table-scroll"><table className="case-table"><thead><tr><th>ผู้ป่วย / นัด</th><th>สถานะเคส</th><th>ความเร่งด่วน</th><th>ผู้รับผิดชอบ / LINE</th><th><span className="sr-only">ดำเนินการ</span></th></tr></thead><tbody>{data.cases.map((item) => <tr key={item.id}><td><Link className="text-link" href={`/patients/${item.patient.id}`}>{item.patient.name}</Link><small>HN {item.patient.hn} · {item.patient.village || "ไม่ระบุหมู่บ้าน"}</small><small>{item.appointment.clinic} · {date(item.appointment.at)}</small></td><td><span className={`status-badge ${item.status}`}>{CASE_STATUS_LABELS[item.status]}</span></td><td><span className={item.priority === "urgent" ? "case-urgent" : ""}>{CASE_PRIORITY_LABELS[item.priority]}</span></td><td><strong>{item.assignee?.name ?? "ยังไม่มอบหมาย"}</strong><small>{item.notificationStatus ? CASE_LINE_LABELS[item.notificationStatus] ?? item.notificationStatus : "ยังไม่มีการแจ้งเตือน"}</small></td><td><Link className="button secondary" href={`/follow-up/${item.id}`}>{item.assignee ? "ดูเคส" : "มอบหมายงาน"}</Link></td></tr>)}</tbody></table></div>}
        {data.total > 25 && <nav className="case-pagination" aria-label="หน้ารายการเคส"><button className="button secondary" disabled={page <= 1} onClick={() => { const next = new URLSearchParams(query); next.set("page", String(page - 1)); router.push(`/cases?${next}`); }}>ก่อนหน้า</button><span>หน้า {page} / {Math.ceil(data.total / 25)}</span><button className="button secondary" disabled={page * 25 >= data.total} onClick={() => { const next = new URLSearchParams(query); next.set("page", String(page + 1)); router.push(`/cases?${next}`); }}>ถัดไป</button></nav>}
      </>}
    </section>
  </>;
}
