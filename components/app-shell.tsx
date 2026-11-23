"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardPlus, HeartPulse, House, Inbox, LogOut, Menu, QrCode, Search, Users, UserCog, X, Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const navigation = [
  { href: "/", label: "ภาพรวม", icon: House, roles: ["admin", "nurse"] },
  { href: "/patients", label: "ผู้ป่วย", icon: Users, roles: ["admin", "nurse"] },
  { href: "/follow-up/demo", label: "บันทึกติดตาม", icon: ClipboardPlus, roles: ["admin", "nurse"] },
  { href: "/education", label: "สื่อสุขภาพ", icon: HeartPulse, roles: ["admin", "nurse"] },
  { href: "/notifications", label: "การแจ้งเตือน", icon: Bell, roles: ["admin", "nurse"] },
  { href: "/requests", label: "คำขอผู้ป่วย", icon: Inbox, roles: ["admin", "nurse"] },
  { href: "/admin/users", label: "จัดการทีม", icon: UserCog, roles: ["admin", "nurse"] },
  { href: "/queue", label: "คิวและ QR", icon: QrCode, roles: ["admin", "nurse"] }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      setRole(profile?.role ?? null);
    });
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const isPublicView = pathname.startsWith("/patient/") || pathname.startsWith("/check-in") || pathname.startsWith("/login") || pathname.startsWith("/reset-password") || pathname.startsWith("/unauthorized") || pathname.startsWith("/liff");
  const active = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);
  const visibleNavigation = role ? navigation.filter((item) => item.roles.includes(role)) : navigation;
  async function signOut() {
    const supabase = createBrowserSupabase();
    await supabase?.auth.signOut();
    window.location.href = "/login";
  }

  if (isPublicView) return <>{children}</>;

  return (
    <div className="app-frame">
      <aside className={`sidebar ${menuOpen ? "is-open" : ""}`} aria-label="เมนูหลัก">
        <div className="brand"><span className="brand-mark"><HeartPulse size={22} /></span><span><strong>รพ.สต. สระโคล่</strong><small>ระบบติดตามผู้ป่วย</small></span></div>
        <nav className="side-nav">
          {visibleNavigation.map((item) => <Link key={item.href} href={item.href} className={active(item.href) ? "active" : ""} onClick={() => setMenuOpen(false)}><item.icon size={19} /><span>{item.label}</span></Link>)}
        </nav>
        <div className="sidebar-note"><CalendarDays size={18} /><span>รอบติดตาม<br /><strong>พ.ย. 2569</strong></span></div>
      </aside>
      <div className="work-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "ปิดเมนู" : "เปิดเมนู"}>{menuOpen ? <X /> : <Menu />}</button>
          <button className="search-pill" onClick={() => setSearchOpen(true)} aria-label="ค้นหา (Command K)"><Search size={17} /><span>ค้นหาผู้ป่วย หรือ HN</span><kbd>⌘ K</kbd></button>
          <div className="staff-chip"><span>กนกวรรณ</span><small>พยาบาลวิชาชีพ</small><button className="icon-button" onClick={signOut} aria-label="ออกจากระบบ" title="ออกจากระบบ"><LogOut size={17} /></button></div>
        </header>
        <main id="main-content">{children}</main>
        <footer className="inline-footer"><strong>รพ.สต. สระโคล่</strong><span>ติดตามด้วยความเข้าใจ รักษาต่อเนื่องด้วยกัน</span><span>ข้อมูลสาธิต</span></footer>
      </div>
      {menuOpen && <button className="menu-backdrop" aria-label="ปิดเมนู" onClick={() => setMenuOpen(false)} />}
      {searchOpen && <div className="command-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSearchOpen(false); }}>
        <section className="command-panel" role="dialog" aria-modal="true" aria-label="ค้นหา">
          <div className="command-input"><Search size={20} /><input ref={searchRef} placeholder="ชื่อผู้ป่วย, HN หรือหมู่บ้าน" aria-label="คำค้น" onKeyDown={(e) => { if (e.key === "Escape") setSearchOpen(false); }} /><button className="icon-button" onClick={() => setSearchOpen(false)} aria-label="ปิด"><X size={18} /></button></div>
          <p className="command-label">ทางลัด</p>
          {visibleNavigation.slice(0, 5).map(item => <Link key={item.href} href={item.href} className="command-item" onClick={() => setSearchOpen(false)}><item.icon size={18} />{item.label}<span>↵</span></Link>)}
        </section>
      </div>}
    </div>
  );
}
