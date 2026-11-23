import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";
import { applyMissedFilters, demoAreas, demoMissedRows, demoVolunteers, mapMissedRowFromRpc, parseMissedQuery, type VolunteerOption } from "@/lib/missed";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const filters = parseMissedQuery(new URL(request.url).searchParams);

  if (!hasSupabaseAdmin()) {
    const demoRows = demoMissedRows();
    const { rows, total } = applyMissedFilters(demoRows, filters);
    return NextResponse.json({ ok: true, mode: "demo", rows, total, page: filters.page, pageSize: filters.pageSize, volunteers: demoVolunteers(demoRows), areas: demoAreas(demoRows) });
  }

  const serviceUnitId = staff.mode === "authenticated" ? staff.serviceUnitId : null;
  if (!serviceUnitId) return NextResponse.json({ ok: false, error: "service_unit_required" }, { status: 403 });

  const supabase = createAdminClient();
  const assignee = filters.assignee && uuidPattern.test(filters.assignee) ? filters.assignee : null;

  const [{ data: result, error: rpcError }, { data: volunteers }, { data: areas }] = await Promise.all([
    supabase.rpc("search_missed_follow_ups", {
      p_service_unit_id: serviceUnitId,
      p_q: filters.q || null,
      p_status: filters.status,
      p_area: filters.area,
      p_assignee: assignee,
      p_unassigned_only: filters.unassignedOnly,
      p_priority: filters.priority,
      p_from: filters.from,
      p_to: filters.to,
      p_page: filters.page,
      p_page_size: filters.pageSize,
      p_sort: filters.sort,
      p_order: filters.order
    }),
    supabase.from("profiles").select("id, full_name").eq("role", "volunteer").eq("active", true).eq("service_unit_id", serviceUnitId).order("full_name"),
    supabase.from("patients").select("village").eq("service_unit_id", serviceUnitId).not("village", "is", null)
  ]);

  if (rpcError) return NextResponse.json({ ok: false, error: rpcError.message ?? "อ่านทะเบียนไม่สำเร็จ" }, { status: 500 });

  const payload = result as { total?: number; rows?: Record<string, unknown>[] } | null;
  const rows = (payload?.rows ?? []).map(mapMissedRowFromRpc);
  const volunteerList: VolunteerOption[] = (volunteers ?? []).map((item) => ({ id: item.id, fullName: item.full_name }));
  const areaList = [...new Set((areas ?? []).map((item) => item.village).filter((value): value is string => Boolean(value)))].sort();

  return NextResponse.json({ ok: true, mode: "database", rows, total: payload?.total ?? 0, page: filters.page, pageSize: filters.pageSize, volunteers: volunteerList, areas: areaList });
}
