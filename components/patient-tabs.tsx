"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileUp, UserPlus } from "lucide-react";

const views = [
  { href: "/patients", label: "ผู้ป่วยทั้งหมด", exact: true },
  { href: "/patients/missed", label: "ผู้ขาดนัด", exact: false }
];

export function PatientTabs() {
  const pathname = usePathname();
  return (
    <div className="patient-nav-row">
      <nav className="patient-view-tabs" aria-label="มุมมองผู้ป่วย">
        {views.map((view) => {
          const active = view.exact ? pathname === view.href : pathname.startsWith(view.href);
          return <Link key={view.href} href={view.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>{view.label}</Link>;
        })}
      </nav>
      <div className="patient-nav-actions">
        <Link className="button secondary" href="/patients/import"><FileUp size={17} />นำเข้าข้อมูล</Link>
        <Link className="button primary" href="/patients/add"><UserPlus size={17} />เพิ่มผู้ป่วย</Link>
      </div>
    </div>
  );
}
