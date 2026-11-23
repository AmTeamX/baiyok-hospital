import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const rpcErrors: Record<string, { status: number; error: string }> = {
  P0002: { status: 404, error: "not_found" },
  P0004: { status: 409, error: "conflict" },
  P0006: { status: 409, error: "not_open" },
  "42501": { status: 403, error: "forbidden" }
};

type ConfirmReturnBody = {
  note?: unknown;
  expectedVersion?: unknown;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as ConfirmReturnBody;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;
  const expectedVersion = Number(body.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return NextResponse.json({ ok: false, error: "version_required" }, { status: 422 });
  }

  if (!hasSupabaseAdmin() || !staff.userId) {
    return NextResponse.json({ ok: true, mode: "demo", follow_up_id: id, version: expectedVersion + 1, status: "returned" });
  }

  const { data, error } = await createAdminClient().rpc("confirm_return_manually", {
    p_follow_up_id: id,
    p_actor_id: staff.userId,
    p_note: note,
    p_expected_version: expectedVersion
  });

  if (error) {
    const mapped = rpcErrors[typeof error.code === "string" ? error.code : ""];
    if (mapped) return NextResponse.json({ ok: false, error: mapped.error }, { status: mapped.status });
    return NextResponse.json({ ok: false, error: "ยืนยันการกลับมารับบริการไม่สำเร็จ" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mode: "database", ...(data as Record<string, unknown>) });
}
