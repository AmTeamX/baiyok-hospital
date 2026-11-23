import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireVolunteer, volunteerAuthStatus } from "@/lib/line/volunteer-auth";
import { mapVolunteerTaskRow, type VolunteerTaskRow } from "@/lib/volunteer";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireVolunteer();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: volunteerAuthStatus(result.reason) });
  }

  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const supabase = createAdminClient();

  let slaHours = 48;
  if (result.identity.serviceUnitId) {
    const { data: unit } = await supabase
      .from("service_units")
      .select("sla_hours")
      .eq("id", result.identity.serviceUnitId)
      .maybeSingle();
    if (unit?.sla_hours) slaHours = Number(unit.sla_hours);
  }

  const { data, error } = await supabase
    .from("follow_ups")
    .select("id, status, priority, assigned_at, contacted_at, missed_reason, version, appointments!follow_ups_appointment_id_fkey(appointment_at, clinic, patients(full_name, village, phone))")
    .eq("id", id)
    .eq("assigned_volunteer_id", result.identity.profileId)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const task = mapVolunteerTaskRow(data as VolunteerTaskRow, slaHours);
  return NextResponse.json({ ok: true, task: { ...task, version: Number((data as { version?: number }).version ?? 1) } });
}
