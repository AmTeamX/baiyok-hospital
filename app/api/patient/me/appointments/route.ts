import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePatient, patientAuthStatus } from "@/lib/line/patient-auth";

export const runtime = "nodejs";

export async function GET() {
  const result = await requirePatient();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: patientAuthStatus(result.reason) });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, appointment_at, clinic, status")
    .eq("patient_id", result.identity.patientId)
    .in("status", ["scheduled", "rescheduled"])
    .gte("appointment_at", new Date().toISOString())
    .order("appointment_at", { ascending: true })
    .limit(20);
  if (error) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });

  const appointments = (data ?? []).map((item) => ({
    id: item.id,
    appointmentAt: item.appointment_at,
    clinic: item.clinic,
    status: item.status
  }));

  return NextResponse.json({ ok: true, appointments });
}
