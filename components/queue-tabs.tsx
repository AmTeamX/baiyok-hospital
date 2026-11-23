"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/queue", label: "คิวรายวัน" },
  { href: "/queue/check-in", label: "QR เช็กอิน" }
];

export function QueueTabs() {
  const pathname = usePathname();
  return <nav className="missed-tabs" aria-label="ส่วนงานคิว">{tabs.map((tab) => <Link key={tab.href} href={tab.href} className={pathname === tab.href ? "active" : ""} aria-current={pathname === tab.href ? "page" : undefined}>{tab.label}</Link>)}</nav>;
}
