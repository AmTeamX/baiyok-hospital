import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  if (!hasSupabaseAdmin() || !staff.serviceUnitId) {
    return NextResponse.json({ ok: true, mode: "demo", appointments: [] });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim().toLocaleLowerCase("th") ?? "";
  const status = url.searchParams.get("status")?.trim() ?? "all";
  const supabase = createAdminClient();

  const { data: patients, error: patientsError } = await supabase
    .from("patients")
    .select("id, hn, full_name, phone, village")
    .eq("service_unit_id", staff.serviceUnitId);
  if (patientsError) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });

  const patientRows = patients ?? [];
  const patientIds = patientRows.map((patient) => patient.id);
  if (patientIds.length === 0) {
    return NextResponse.json({ ok: true, mode: "database", appointments: [] });
  }

  let appointmentQuery = supabase
    .from("appointments")
    .select("id, patient_id, appointment_at, clinic, status, attended_at, missed_marked_at")
    .in("patient_id", patientIds)
    .order("appointment_at", { ascending: false })
    .limit(500);
  if (status !== "all") appointmentQuery = appointmentQuery.eq("status", status);

  const { data: appointments, error } = await appointmentQuery;
  if (error) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });

  const patientMap = new Map(patientRows.map((patient) => [patient.id, patient]));
  const rows = (appointments ?? [])
    .map((appointment) => {
      const patient = patientMap.get(appointment.patient_id);
      return patient ? {
        id: appointment.id,
        appointmentAt: appointment.appointment_at,
        clinic: appointment.clinic,
        status: appointment.status,
        attendedAt: appointment.attended_at,
        missedMarkedAt: appointment.missed_marked_at,
        patient: {
          id: patient.id,
          hn: patient.hn,
          fullName: patient.full_name,
          phone: patient.phone,
          village: patient.village
        }
      } : null;
    })
    .filter((appointment): appointment is NonNullable<typeof appointment> => Boolean(appointment));

  const filtered = query
    ? rows.filter((appointment) => `${appointment.patient.fullName} ${appointment.patient.hn} ${appointment.patient.phone ?? ""} ${appointment.clinic}`
        .toLocaleLowerCase("th")
        .includes(query))
    : rows;

  return NextResponse.json({ ok: true, mode: "database", appointments: filtered });
}
