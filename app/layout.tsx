import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@fontsource-variable/noto-sans-thai";
import "../tokens.css";
import "./globals.css";
import "./workspace.css";
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
      <body><Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" strategy="beforeInteractive" /><AppShell>{children}</AppShell></body>
    </html>
  );
}
