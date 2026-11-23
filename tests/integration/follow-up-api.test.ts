import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireClinicalStaff: vi.fn(),
  hasSupabaseAdmin: vi.fn(),
  createAdminClient: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({ requireClinicalStaff: mocks.requireClinicalStaff }));
vi.mock("@/lib/supabase/admin", () => ({ hasSupabaseAdmin: mocks.hasSupabaseAdmin, createAdminClient: mocks.createAdminClient }));

import { GET, PATCH } from "@/app/api/follow-ups/[id]/route";
import { POST } from "@/app/api/follow-ups/[id]/activities/route";

const followUpId = "11111111-1111-4111-8111-111111111111";
const actorId = "33333333-3333-4333-8333-333333333333";
const staff = { mode: "authenticated" as const, userId: actorId, serviceUnitId: "unit-1", role: "nurse" as const };

function params(id = followUpId) {
  return { params: Promise.resolve({ id }) };
}
function jsonRequest(method: string, body: unknown, url = `http://localhost/api/follow-ups/${followUpId}`) {
  return new Request(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/follow-ups/[id]", () => {
  it.each(["object", "array"])("opens a real case when the related patient is returned as an %s", async (shape) => {
    mocks.requireClinicalStaff.mockResolvedValue(staff);
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    const patient = { id: "patient-1", hn: "00123", full_name: "ผู้ป่วยทดสอบ", birth_date: null, village: "หมู่ 1", phone: null, service_unit_id: "unit-1" };
    mocks.createAdminClient.mockReturnValue({ from: (table: string) => {
      const data = table === "follow_ups" ? { id: followUpId, appointment_id: "appt-1", status: "assigned", priority: "normal", assigned_volunteer_id: null, version: 1 } : table === "appointments" ? { id: "appt-1", appointment_at: "2026-11-24T01:00:00Z", clinic: "คลินิกทดสอบ", patients: shape === "object" ? patient : [patient] } : [];
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "order", "in", "limit"]) chain[method] = () => chain;
      chain.maybeSingle = chain.single = async () => ({ data, error: null });
      chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
      return chain;
    } });
    const response = await GET(new Request(`http://localhost/api/follow-ups/${followUpId}`), params());
    expect(response.status).toBe(200);
    expect((await response.json()).followUp.patient.fullName).toBe("ผู้ป่วยทดสอบ");
  });
  it("rejects unauthenticated callers", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/follow-ups/x"), params());
    expect(response.status).toBe(401);
  });

  it("returns a demo case detail when Supabase is not configured", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "demo", userId: null, serviceUnitId: null, role: null });
    mocks.hasSupabaseAdmin.mockReturnValue(false);
    const response = await GET(new Request("http://localhost/api/follow-ups/pt-001"), params("pt-001"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, mode: "demo" });
  });

  it("returns 404 for an unknown demo id", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "demo", userId: null, serviceUnitId: null, role: null });
    mocks.hasSupabaseAdmin.mockReturnValue(false);
    const response = await GET(new Request("http://localhost/api/follow-ups/unknown"), params("unknown"));
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/follow-ups/[id]", () => {
  it("requires a version", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(staff);
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    const response = await PATCH(jsonRequest("PATCH", { status: "assigned" }), params());
    expect(response.status).toBe(422);
  });

  it("updates through the RPC and returns the new version", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(staff);
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    const rpc = vi.fn().mockResolvedValue({ data: { version: 2, status: "assigned", priority: "normal" }, error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await PATCH(jsonRequest("PATCH", { version: 1, status: "assigned", missedReason: "ลืมวันนัด" }), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, version: 2 });
    expect(rpc).toHaveBeenCalledWith("update_follow_up", expect.objectContaining({ p_follow_up_id: followUpId, p_expected_version: 1, p_actor_id: actorId }));
  });

  it("maps a version conflict to 409", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(staff);
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    mocks.createAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "P0004", message: "version_conflict" } }) });

    const response = await PATCH(jsonRequest("PATCH", { version: 1, status: "assigned" }), params());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "conflict" });
  });

  it("maps a forbidden (cross service unit) result to 403", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(staff);
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    mocks.createAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "42501", message: "forbidden" } }) });

    const response = await PATCH(jsonRequest("PATCH", { version: 1, status: "assigned" }), params());
    expect(response.status).toBe(403);
  });

  it("maps a missing follow-up to 404", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(staff);
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    mocks.createAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "P0002", message: "follow_up_not_found" } }) });

    const response = await PATCH(jsonRequest("PATCH", { version: 1, status: "assigned" }), params());
    expect(response.status).toBe(404);
  });
});

describe("POST /api/follow-ups/[id]/activities", () => {
  it("rejects a missing activity type", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(staff);
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    const response = await POST(jsonRequest("POST", { note: "ไม่มีประเภท" }), params());
    expect(response.status).toBe(422);
  });

  it("appends an activity through the RPC", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(staff);
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    const rpc = vi.fn().mockResolvedValue({ data: { activity_id: "a1", follow_up_id: followUpId }, error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await POST(jsonRequest("POST", { activityType: "โทรศัพท์ติดตาม", note: "ติดต่อได้" }), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, activity_id: "a1" });
    expect(rpc).toHaveBeenCalledWith("add_follow_up_activity", expect.objectContaining({ p_follow_up_id: followUpId, p_activity_type: "โทรศัพท์ติดตาม" }));
  });

  it("maps a forbidden (cross service unit) result to 403", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(staff);
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    mocks.createAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "42501", message: "forbidden" } }) });

    const response = await POST(jsonRequest("POST", { activityType: "โทรศัพท์ติดตาม" }), params());
    expect(response.status).toBe(403);
  });
});
