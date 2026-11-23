import { NextResponse } from "next/server";
import { requireVolunteer, volunteerAuthStatus } from "@/lib/line/volunteer-auth";

export const runtime = "nodejs";

export async function GET() {
  const result = await requireVolunteer();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: volunteerAuthStatus(result.reason) });
  }
  return NextResponse.json({ ok: true, volunteer: { id: result.identity.profileId, fullName: result.identity.fullName } });
}
