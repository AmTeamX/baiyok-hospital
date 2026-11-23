import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireClinicalStaff: vi.fn(),
  hasSupabaseAdmin: vi.fn(),
  createAdminClient: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({ requireClinicalStaff: mocks.requireClinicalStaff }));
vi.mock("@/lib/supabase/admin", () => ({ hasSupabaseAdmin: mocks.hasSupabaseAdmin, createAdminClient: mocks.createAdminClient }));

import { POST } from "@/app/api/follow-ups/[id]/assign/route";

const followUpId = "11111111-1111-4111-8111-111111111111";
const volunteerId = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333";

function request(body: unknown) {
  return new Request("http://localhost/api/follow-ups/x/assign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

const params = Promise.resolve({ id: followUpId });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/follow-ups/[id]/assign", () => {
  it("rejects unauthenticated callers", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(null);
    const response = await POST(request({ volunteer_id: volunteerId }), { params });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "unauthorized" });
  });

  it("rejects a missing volunteer id", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    const response = await POST(request({}), { params });
    expect(response.status).toBe(422);
  });

  it("assigns via the RPC and reports the notification state", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    const rpc = vi.fn().mockResolvedValue({
      data: { follow_up_id: followUpId, volunteer_id: volunteerId, reassigned: false, idempotent: false, notification_id: "n1", notification_status: "pending" },
      error: null
    });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await POST(request({ volunteer_id: volunteerId }), { params });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.notification_status).toBe("pending");
    expect(rpc).toHaveBeenCalledWith("assign_follow_up", { p_follow_up_id: followUpId, p_volunteer_id: volunteerId, p_actor_id: actorId });
  });

  it("rejects an inactive or wrong-unit volunteer", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    mocks.createAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "P0003", message: "volunteer_invalid" } }) });

    const response = await POST(request({ volunteer_id: volunteerId }), { params });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: "อสม. ไม่มีสิทธิ์รับงาน (ไม่ active หรืออยู่ต่างหน่วยบริการ)" });
  });

  it("maps a missing follow-up to 404", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    mocks.createAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "P0002", message: "follow_up_not_found" } }) });

    const response = await POST(request({ volunteer_id: volunteerId }), { params });
    expect(response.status).toBe(404);
  });
});
