import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    clinic?: unknown;
    serviceDate?: unknown;
    startsAt?: unknown;
    endsAt?: unknown;
    capacity?: unknown;
  };
  const clinic = typeof body.clinic === "string" ? body.clinic.trim() : "";
  const serviceDate = typeof body.serviceDate === "string" ? body.serviceDate : "";
  const startsAt = typeof body.startsAt === "string" ? body.startsAt : "";
  const endsAt = typeof body.endsAt === "string" ? body.endsAt : "";
  const capacity = Number(body.capacity);

  if (!clinic || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 422 });
  }
  if (Number.isNaN(Date.parse(startsAt)) || Number.isNaN(Date.parse(endsAt))) {
    return NextResponse.json({ ok: false, error: "invalid_time" }, { status: 422 });
  }
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) {
    return NextResponse.json({ ok: false, error: "invalid_capacity" }, { status: 422 });
  }

  if (!hasSupabaseAdmin() || !staff.userId) {
    return NextResponse.json({ ok: true, mode: "demo", slotId: "demo" });
  }

  const { data, error } = await createAdminClient().rpc("create_queue_slot", {
    p_clinic: clinic,
    p_service_date: serviceDate,
    p_starts_at: new Date(startsAt).toISOString(),
    p_ends_at: new Date(endsAt).toISOString(),
    p_capacity: capacity,
    p_actor_id: staff.userId
  });

  if (error) {
    if (typeof error.code === "string" && (error.code === "P0008")) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 422 });
    }
    return NextResponse.json({ ok: false, error: "สร้าง slot ไม่สำเร็จ" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mode: "database", ...(data as Record<string, unknown>) });
}
