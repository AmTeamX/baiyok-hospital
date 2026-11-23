import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";
import { QUEUE_BOOKING_STATUS_LABELS, type QueueBookingStatus } from "@/lib/queue";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const date = params.get("date") ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "invalid_date" }, { status: 422 });
  }

  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ ok: true, mode: "demo", date, slots: [] });
  }

  const supabase = createAdminClient();
  const { data: slots, error } = await supabase
    .from("queue_slots")
    .select("id, clinic, service_date, starts_at, ends_at, capacity, booked_count, active")
    .eq("service_date", date)
    .order("starts_at", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });

  const slotIds = (slots ?? []).map((slot) => slot.id);
  const { data: bookings } = slotIds.length
    ? await supabase
        .from("queue_bookings")
        .select("id, slot_id, queue_number, status, booked_at, checked_in_at, patients(full_name)")
        .in("slot_id", slotIds)
        .order("queue_number", { ascending: true })
    : { data: [] };

  const bookingsBySlot = new Map<string, Record<string, unknown>[]>();
  for (const booking of (bookings ?? []) as Array<Record<string, unknown>>) {
    const list = bookingsBySlot.get(String(booking.slot_id)) ?? [];
    list.push(booking);
    bookingsBySlot.set(String(booking.slot_id), list);
  }

  const result = (slots ?? []).map((slot) => {
    const slotBookings = (bookingsBySlot.get(slot.id) ?? []).map((booking) => ({
      id: String(booking.id),
      queueNumber: Number(booking.queue_number),
      status: String(booking.status),
      statusLabel: QUEUE_BOOKING_STATUS_LABELS[booking.status as QueueBookingStatus] ?? String(booking.status),
      patientName: (booking.patients as Array<{ full_name: string }> | null)?.[0]?.full_name ?? null,
      bookedAt: booking.booked_at ?? null,
      checkedInAt: booking.checked_in_at ?? null
    }));
    const checkedIn = slotBookings.filter((booking) => booking.status === "checked_in").length;
    const noShow = slotBookings.filter((booking) => booking.status === "no_show").length;
    return {
      id: slot.id,
      clinic: slot.clinic,
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
      capacity: slot.capacity,
      bookedCount: slot.booked_count,
      active: slot.active,
      checkedIn,
      noShow,
      bookings: slotBookings
    };
  });

  return NextResponse.json({ ok: true, mode: "database", date, slots: result });
}
