import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePatient, patientAuthStatus } from "@/lib/line/patient-auth";

export const runtime = "nodejs";

export async function GET() {
  const result = await requirePatient();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: patientAuthStatus(result.reason) });
  }

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("queue_slots")
    .select("id, clinic, service_date, starts_at, ends_at, capacity, booked_count, active")
    .eq("active", true)
    .gte("service_date", today)
    .order("service_date", { ascending: true })
    .order("starts_at", { ascending: true })
    .limit(50);
  if (error) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });

  const slots = (data ?? [])
    .filter((slot) => slot.booked_count < slot.capacity)
    .map((slot) => ({
      id: slot.id,
      clinic: slot.clinic,
      serviceDate: slot.service_date,
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
      capacity: slot.capacity,
      bookedCount: slot.booked_count,
      remaining: slot.capacity - slot.booked_count
    }));

  return NextResponse.json({ ok: true, slots });
}
