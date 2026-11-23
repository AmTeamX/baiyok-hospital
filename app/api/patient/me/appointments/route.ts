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
    .order("appointment_at", { ascending: true })
    .limit(50);
  if (error) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });

  const now = Date.now();
  const mapped = (data ?? []).map((item) => ({
    id: item.id,
    appointmentAt: item.appointment_at,
    clinic: item.clinic,
    status: item.status
  }));
  const appointments = mapped
    .filter((item) => ["scheduled", "rescheduled"].includes(item.status) && new Date(item.appointmentAt).getTime() >= now)
    .slice(0, 20);
  const history = mapped
    .filter((item) => new Date(item.appointmentAt).getTime() < now && ["scheduled", "rescheduled", "attended", "missed", "cancelled"].includes(item.status))
    .filter((item) => item.status !== "rescheduled")
    .sort((a, b) => new Date(b.appointmentAt).getTime() - new Date(a.appointmentAt).getTime())
    .slice(0, 10);

  return NextResponse.json({ ok: true, appointments, history });
}
