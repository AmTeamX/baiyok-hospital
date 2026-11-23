import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireVolunteer, volunteerAuthStatus } from "@/lib/line/volunteer-auth";
import {
  isValidVolunteerTaskFilter,
  mapVolunteerTaskRow,
  taskFilterToStatuses,
  type VolunteerTaskFilter,
  type VolunteerTaskRow
} from "@/lib/volunteer";

export const runtime = "nodejs";

const DEFAULT_SLA_HOURS = 48;

export async function GET(request: Request) {
  const result = await requireVolunteer();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: volunteerAuthStatus(result.reason) });
  }

  const filter = (new URL(request.url).searchParams.get("filter") ?? "all") as VolunteerTaskFilter;
  if (!isValidVolunteerTaskFilter(filter)) {
    return NextResponse.json({ ok: false, error: "invalid_filter" }, { status: 422 });
  }

  const supabase = createAdminClient();

  let slaHours = DEFAULT_SLA_HOURS;
  if (result.identity.serviceUnitId) {
    const { data: unit } = await supabase
      .from("service_units")
      .select("sla_hours")
      .eq("id", result.identity.serviceUnitId)
      .maybeSingle();
    if (unit?.sla_hours) slaHours = Number(unit.sla_hours);
  }

  const statuses = taskFilterToStatuses(filter);
  let query = supabase
    .from("follow_ups")
    .select("id, status, priority, assigned_at, contacted_at, missed_reason, appointments(appointment_at, clinic), patients(full_name, village, phone)")
    .eq("assigned_volunteer_id", result.identity.profileId)
    .in("status", statuses)
    .order("updated_at", { ascending: false });

  if (filter === "urgent") query = query.eq("priority", "urgent");

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });

  const tasks = (data ?? []).map((row) => mapVolunteerTaskRow(row as VolunteerTaskRow, slaHours));

  return NextResponse.json({ ok: true, tasks });
}
