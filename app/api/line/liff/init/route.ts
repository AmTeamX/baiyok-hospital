import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { setNonceCookie } from "@/lib/line/session";

export async function GET() {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
  if (!liffId) return NextResponse.json({ ok: false, error: "liff_not_configured" }, { status: 503 });
  const nonce = randomBytes(24).toString("base64url");
  await setNonceCookie(nonce);
  return NextResponse.json({ ok: true, nonce, liffId });
}
