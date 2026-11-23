"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, ChevronRight, CircleHelp, HeartPulse, House, Inbox, LogOut, Menu, QrCode, Search, UserCog, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type NavigationItem = { href: string; label: string; description: string; icon: typeof House; roles: string[] };
type NavigationGroup = { label: string; items: NavigationItem[] };

const navigation: NavigationGroup[] = [
  { label: "งานประจำวัน", items: [
    { href: "/", label: "ศูนย์งาน", description: "ภาพรวมและงานเร่งด่วน", icon: House, roles: ["admin", "nurse"] },
    { href: "/patients", label: "ผู้ป่วย", description: "ทะเบียนและผู้ขาดนัด", icon: Users, roles: ["admin", "nurse"] },
    { href: "/requests", label: "คำขอผู้ป่วย", description: "รับเรื่องและติดตามสถานะ", icon: Inbox, roles: ["admin", "nurse"] },
    { href: "/queue", label: "คิวบริการ", description: "ตารางคิวและเช็กอิน", icon: QrCode, roles: ["admin", "nurse"] }
  ] },
  { label: "การสื่อสาร", items: [
    { href: "/notifications", label: "การส่งข้อความ", description: "สถานะ LINE และส่งซ้ำ", icon: Bell, roles: ["admin", "nurse"] },
    { href: "/education", label: "สื่อสุขภาพ", description: "เนื้อหาสำหรับผู้ป่วย", icon: HeartPulse, roles: ["admin", "nurse"] }
  ] },
  { label: "ระบบ", items: [
    { href: "/imports", label: "ประวัตินำเข้า", description: "ตรวจสอบชุดข้อมูลย้อนหลัง", icon: CalendarDays, roles: ["admin", "nurse"] },
    { href: "/admin/users", label: "ทีมและสิทธิ์", description: "เจ้าหน้าที่และ อสม.", icon: UserCog, roles: ["admin", "nurse"] }
  ] }
];

const routeNames: Record<string, string> = {
  patients: "ผู้ป่วย", missed: "ผู้ขาดนัด", add: "เพิ่มข้อมูล", import: "นำเข้าข้อมูล", imports: "ประวัตินำเข้า",
  requests: "คำขอผู้ป่วย", queue: "คิวบริการ", notifications: "การส่งข้อความ", education: "สื่อสุขภาพ",
  admin: "ระบบ", users: "ทีมและสิทธิ์", "follow-up": "บันทึกติดตาม"
  , "check-in": "QR เช็กอิน"
};
const roleNames: Record<string, string> = { admin: "ผู้ดูแลระบบ", nurse: "พยาบาล", volunteer: "อสม." };

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<{ name: string; role: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if (event.key === "Escape") { setSearchOpen(false); setMenuOpen(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
      if (data) setProfile({ name: data.full_name, role: data.role });
    });
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); else setQuery(""); }, [searchOpen]);

  const isPublicView = pathname.startsWith("/patient/") || pathname.startsWith("/check-in") || pathname.startsWith("/login") || pathname.startsWith("/reset-password") || pathname.startsWith("/unauthorized") || pathname.startsWith("/liff");
  const active = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);
  const visibleGroups = navigation.map((group) => ({ ...group, items: group.items.filter((item) => !profile || item.roles.includes(profile.role)) })).filter((group) => group.items.length > 0);
  const allItems = visibleGroups.flatMap((group) => group.items);
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th");
    return normalized ? allItems.filter((item) => `${item.label} ${item.description}`.toLocaleLowerCase("th").includes(normalized)) : allItems;
  }, [allItems, query]);
  const breadcrumbs = pathname.split("/").filter(Boolean).filter((segment) => segment !== "demo" && !/^[0-9a-f-]{8,}$/i.test(segment));
  const periodLabel = new Intl.DateTimeFormat("th-TH", { month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date());

  async function signOut() { const supabase = createBrowserSupabase(); await supabase?.auth.signOut(); window.location.href = "/login"; }
  if (isPublicView) return <>{children}</>;

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">ข้ามไปเนื้อหาหลัก</a>
      <aside className={`sidebar ${menuOpen ? "is-open" : ""}`} aria-label="เมนูหลัก">
        <div className="brand"><span className="brand-mark"><HeartPulse size={21} /></span><span><strong>CareBack</strong><small>รพ.สต. สระโคล่</small></span><button className="icon-button sidebar-close" onClick={() => setMenuOpen(false)} aria-label="ปิดเมนู"><X size={19} /></button></div>
        <nav className="side-nav">
          {visibleGroups.map((group) => <section className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map((item) => <Link key={item.href} href={item.href} className={active(item.href) ? "active" : ""} aria-current={active(item.href) ? "page" : undefined}><item.icon size={18} /><span>{item.label}</span></Link>)}</section>)}
        </nav>
        <div className="sidebar-note"><CalendarDays size={17} /><span>รอบดำเนินงาน<strong>{periodLabel}</strong></span></div>
      </aside>

      <div className="work-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="เปิดเมนู"><Menu size={21} /></button>
          <div className="topbar-context"><span>พื้นที่ทำงาน</span><strong>{allItems.find((item) => active(item.href))?.label ?? "รายละเอียดงาน"}</strong></div>
          <button className="search-pill" onClick={() => setSearchOpen(true)} aria-label="ค้นหาเมนูและทางลัด (Command K)"><Search size={17} /><span>ค้นหาเมนูและทางลัด</span><kbd>⌘ K</kbd></button>
          <Link className="icon-button help-button" href="/education" aria-label="ศูนย์ช่วยเหลือ" title="ศูนย์ช่วยเหลือ"><CircleHelp size={19} /></Link>
          <div className="staff-chip"><span className="staff-avatar" aria-hidden="true">{profile?.name?.slice(0, 1) ?? "จ"}</span><span className="staff-copy"><strong>{profile?.name ?? "เจ้าหน้าที่"}</strong><small>{roleNames[profile?.role ?? ""] ?? "กำลังตรวจสอบสิทธิ์"}</small></span><button className="icon-button" onClick={signOut} aria-label="ออกจากระบบ" title="ออกจากระบบ"><LogOut size={17} /></button></div>
        </header>
        {breadcrumbs.length > 0 && <nav className="breadcrumbs" aria-label="ตำแหน่งปัจจุบัน"><Link href="/">ศูนย์งาน</Link>{breadcrumbs.map((segment, index) => { const href = `/${breadcrumbs.slice(0, index + 1).join("/")}`; const isLast = index === breadcrumbs.length - 1; return <span key={href}><ChevronRight size={14} />{isLast ? <strong aria-current="page">{routeNames[segment] ?? "รายละเอียด"}</strong> : <Link href={href}>{routeNames[segment] ?? "รายละเอียด"}</Link>}</span>; })}</nav>}
        <main id="main-content" tabIndex={-1}>{children}</main>
      </div>

      {menuOpen && <button className="menu-backdrop" aria-label="ปิดเมนู" onClick={() => setMenuOpen(false)} />}
      {searchOpen && <div className="command-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}><section className="command-panel" role="dialog" aria-modal="true" aria-label="ค้นหาเมนูและทางลัด"><div className="command-input"><Search size={20} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="พิมพ์ชื่อเมนู เช่น ผู้ป่วย หรือ คิว" aria-label="คำค้น" /><button className="icon-button" onClick={() => setSearchOpen(false)} aria-label="ปิด"><X size={18} /></button></div><div className="command-meta"><span>ทางลัดทั้งหมด</span><kbd>ESC ปิด</kbd></div><div className="command-results">{searchResults.map((item) => <Link key={item.href} href={item.href} className="command-item" onClick={() => setSearchOpen(false)}><span className="command-icon"><item.icon size={18} /></span><span><strong>{item.label}</strong><small>{item.description}</small></span><ChevronRight size={16} /></Link>)}{searchResults.length === 0 && <div className="command-empty"><Search size={20} /><strong>ไม่พบเมนูที่ค้นหา</strong><small>ลองใช้คำสั้นลง หรือค้นจากชื่องาน</small></div>}</div></section></div>}
    </div>
  );
}
