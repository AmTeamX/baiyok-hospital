import { NextResponse } from "next/server";
import { clearLiffSession } from "@/lib/line/session";

export async function POST() {
  await clearLiffSession();
  return NextResponse.json({ ok: true });
}
