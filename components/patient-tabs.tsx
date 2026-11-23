"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/patients", label: "ทะเบียนผู้ป่วย", exact: true },
  { href: "/patients/missed", label: "ผู้ขาดนัด", exact: false },
  { href: "/patients/import", label: "นำเข้าข้อมูล", exact: false },
  { href: "/patients/add", label: "เพิ่มรายบุคคล", exact: false }
];

export function PatientTabs() {
  const pathname = usePathname();
  return (
    <nav className="missed-tabs" aria-label="เมนูผู้ป่วย">
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
