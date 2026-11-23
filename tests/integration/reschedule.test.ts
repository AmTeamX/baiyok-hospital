import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireClinicalStaff: vi.fn(),
  hasSupabaseAdmin: vi.fn(),
  createAdminClient: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({ requireClinicalStaff: mocks.requireClinicalStaff }));
vi.mock("@/lib/supabase/admin", () => ({ hasSupabaseAdmin: mocks.hasSupabaseAdmin, createAdminClient: mocks.createAdminClient }));

import { POST } from "@/app/api/follow-ups/[id]/reschedule/route";

const followUpId = "11111111-1111-4111-8111-111111111111";
const actorId = "33333333-3333-4333-8333-333333333333";

function request(body: unknown) {
  return new Request("http://localhost/api/follow-ups/x/reschedule", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

const params = Promise.resolve({ id: followUpId });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/follow-ups/[id]/reschedule", () => {
  it("rejects a volunteer/patient (non clinical staff)", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(null);
    const response = await POST(request({ appointment_at: "2026-12-01T08:00:00+07:00" }), { params });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "unauthorized" });
  });

  it("rejects a missing appointment time", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    const response = await POST(request({}), { params });
    expect(response.status).toBe(422);
  });

  it("reschedules through the RPC with normalized priority", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    const rpc = vi.fn().mockResolvedValue({ data: { follow_up_id: followUpId, new_appointment_id: "n1", priority: "urgent" }, error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await POST(request({ appointment_at: "2026-12-01T08:00:00+07:00", priority: "urgent" }), { params });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, priority: "urgent" });
    expect(rpc).toHaveBeenCalledWith("reschedule_follow_up", {
      p_follow_up_id: followUpId,
      p_appointment_at: new Date("2026-12-01T08:00:00+07:00").toISOString(),
      p_priority: "urgent",
      p_actor_id: actorId
    });
  });

  it("maps a forbidden RPC result to 403", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    mocks.createAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "42501", message: "forbidden" } }) });

    const response = await POST(request({ appointment_at: "2026-12-01T08:00:00+07:00" }), { params });
    expect(response.status).toBe(403);
  });
});
