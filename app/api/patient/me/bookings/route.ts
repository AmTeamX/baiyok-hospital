import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePatient, patientAuthStatus } from "@/lib/line/patient-auth";
import { signCheckInToken } from "@/lib/check-in-token";
import { QUEUE_BOOKING_STATUS_LABELS, type QueueBookingStatus } from "@/lib/queue";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const rpcErrors: Record<string, { status: number; error: string }> = {
  P0002: { status: 404, error: "not_found" },
  P0006: { status: 409, error: "slot_inactive" },
  P0007: { status: 409, error: "conflict" }
};

function mapBooking(item: {
  id: string;
  slot_id: string;
  queue_number: number;
  status: QueueBookingStatus;
  booked_at: string;
  checked_in_at: string | null;
  queue_slots: Array<{ clinic: string; service_date: string; starts_at: string }> | { clinic: string; service_date: string; starts_at: string } | null;
}) {
  const slot = Array.isArray(item.queue_slots) ? item.queue_slots[0] ?? null : item.queue_slots ?? null;
  return {
    id: item.id,
    queueNumber: item.queue_number,
    status: item.status,
    statusLabel: QUEUE_BOOKING_STATUS_LABELS[item.status] ?? item.status,
    clinic: slot?.clinic ?? "",
    serviceDate: slot?.service_date ?? "",
    startsAt: slot?.starts_at ?? "",
    bookedAt: item.booked_at,
    checkedInAt: item.checked_in_at
  };
}

export async function GET() {
  const result = await requirePatient();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: patientAuthStatus(result.reason) });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("queue_bookings")
    .select("id, slot_id, queue_number, status, booked_at, checked_in_at, queue_slots(clinic, service_date, starts_at)")
    .eq("patient_id", result.identity.patientId)
    .order("booked_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });

  const bookings = (data ?? []).map((item) => mapBooking(item as Parameters<typeof mapBooking>[0]));
  return NextResponse.json({ ok: true, bookings });
}

export async function POST(request: Request) {
  const result = await requirePatient();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: patientAuthStatus(result.reason) });
  }

  const body = (await request.json().catch(() => ({}))) as { slotId?: unknown };
  if (typeof body.slotId !== "string" || !uuidPattern.test(body.slotId)) {
    return NextResponse.json({ ok: false, error: "invalid_slot" }, { status: 422 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("book_slot", {
    p_slot_id: body.slotId,
    p_patient_id: result.identity.patientId
  });

  if (error) {
    const mapped = rpcErrors[typeof error.code === "string" ? error.code : ""];
    if (mapped) return NextResponse.json({ ok: false, error: mapped.error }, { status: mapped.status });
    return NextResponse.json({ ok: false, error: "จองคิวไม่สำเร็จ" }, { status: 500 });
  }

  const payload = data as { booking_id: string; appointment_id: string; queue_number: number; slot_id: string };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const checkInUrl = `${appUrl.replace(/\/+$/, "")}/check-in?appointment=${encodeURIComponent(payload.appointment_id)}&token=${encodeURIComponent(signCheckInToken(payload.appointment_id))}`;

  return NextResponse.json({
    ok: true,
    bookingId: payload.booking_id,
    queueNumber: payload.queue_number,
    checkInUrl
  });
}
