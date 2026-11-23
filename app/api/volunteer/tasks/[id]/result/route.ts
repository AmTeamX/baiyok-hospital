import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireVolunteer, volunteerAuthStatus } from "@/lib/line/volunteer-auth";
import { isValidVolunteerChannel, isValidVolunteerResult, type VolunteerResultCode } from "@/lib/volunteer";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const rpcErrors: Record<string, { status: number; error: string }> = {
  P0002: { status: 404, error: "not_found" },
  P0004: { status: 409, error: "conflict" },
  P0006: { status: 409, error: "not_open" },
  "42501": { status: 403, error: "forbidden" }
};

type ResultBody = {
  resultCode?: unknown;
  note?: unknown;
  channel?: unknown;
  expectedVersion?: unknown;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireVolunteer();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: volunteerAuthStatus(result.reason) });
  }

  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as ResultBody;
  if (!isValidVolunteerResult(body.resultCode)) {
    return NextResponse.json({ ok: false, error: "invalid_result" }, { status: 422 });
  }
  const channel = isValidVolunteerChannel(body.channel) ? body.channel : "other";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;
  const expectedVersion = Number(body.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return NextResponse.json({ ok: false, error: "version_required" }, { status: 422 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("record_volunteer_result", {
    p_follow_up_id: id,
    p_actor_id: result.identity.profileId,
    p_result_code: body.resultCode as VolunteerResultCode,
    p_note: note,
    p_channel: channel,
    p_expected_version: expectedVersion
  });

  if (error) {
    const mapped = rpcErrors[typeof error.code === "string" ? error.code : ""];
    if (mapped) return NextResponse.json({ ok: false, error: mapped.error }, { status: mapped.status });
    return NextResponse.json({ ok: false, error: "บันทึกผลไม่สำเร็จ" }, { status: 500 });
  }

  const payload = data as { version?: number; status?: string; priority?: string };
  return NextResponse.json({ ok: true, version: payload.version, status: payload.status, priority: payload.priority });
}
