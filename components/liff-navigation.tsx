"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, HeartPulse, History, MessageCircle, UserRound } from "lucide-react";

export function LiffNavigation() {
  const pathname = usePathname();
  if (pathname === "/liff/link" || pathname === "/liff/context") return null;
  const volunteer = pathname.startsWith("/liff/volunteer");
  const items = volunteer ? [
    { href: "/liff/volunteer", label: "งานของฉัน", icon: ClipboardList },
    { href: "/liff/volunteer/history", label: "ประวัติ", icon: History },
    { href: "/liff/volunteer/contact-nurse", label: "ติดต่อพยาบาล", icon: MessageCircle },
    { href: "/liff/context", label: "บัญชี", icon: UserRound }
  ] : [
    { href: "/liff/appointments", label: "วันนัด", icon: CalendarDays },
    { href: "/liff/education", label: "ดูแลสุขภาพ", icon: HeartPulse },
    { href: "/liff/consult", label: "ปรึกษา", icon: MessageCircle },
    { href: "/liff/context", label: "บัญชี", icon: UserRound }
  ];
  return <nav className="liff-bottom-nav" aria-label={volunteer ? "เมนู อสม." : "เมนูผู้ป่วย"}>{items.map((item) => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}><item.icon size={21} /><span>{item.label}</span></Link>)}</nav>;
}
