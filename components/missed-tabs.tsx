"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/missed", label: "ทะเบียนผู้ขาดนัด", exact: true },
  { href: "/missed/import", label: "นำเข้าข้อมูล", exact: false },
  { href: "/missed/add", label: "เพิ่มรายบุคคล", exact: false }
];

export function MissedTabs() {
  const pathname = usePathname();
  return (
    <nav className="missed-tabs" aria-label="เมนูผู้ขาดนัด">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
