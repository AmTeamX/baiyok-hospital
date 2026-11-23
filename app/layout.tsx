import type { Metadata, Viewport } from "next";
import "@fontsource-variable/noto-sans-thai";
import "../tokens.css";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "รพ.สต. สระโคล่ | ระบบติดตามผู้ป่วยขาดนัด",
  description: "ระบบพยาบาล รพ.สต. สระโคล่ สำหรับติดตามผู้ป่วยความดันโลหิตสูงที่ขาดนัด"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
