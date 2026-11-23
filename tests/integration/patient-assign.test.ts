import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireClinicalStaff: vi.fn(),
  hasSupabaseAdmin: vi.fn(),
  createAdminClient: vi.fn(),
  dispatchNotifications: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({ requireClinicalStaff: mocks.requireClinicalStaff }));
vi.mock("@/lib/supabase/admin", () => ({ hasSupabaseAdmin: mocks.hasSupabaseAdmin, createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/notification-dispatch", () => ({ dispatchNotifications: mocks.dispatchNotifications }));

import { POST } from "@/app/api/patients/[id]/assign/route";

const actorId = "33333333-3333-4333-8333-333333333333";
const patientId = "11111111-1111-4111-8111-111111111111";
const volunteerId = "22222222-2222-4222-8222-222222222222";

function request(body: unknown) {
  return new Request("http://localhost/api/patients/x/assign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasSupabaseAdmin.mockReturnValue(true);
  mocks.dispatchNotifications.mockResolvedValue({ sent: 2 });
});

describe("POST /api/patients/[id]/assign", () => {
  it("rejects an unauthenticated caller", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(null);
    expect((await POST(request({ volunteerId }), { params: Promise.resolve({ id: patientId }) })).status).toBe(401);
  });

  it("rejects a missing volunteer id", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    expect((await POST(request({}), { params: Promise.resolve({ id: patientId }) })).status).toBe(422);
  });

  it("assigns via the RPC", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    const rpc = vi.fn().mockResolvedValue({ data: { patient_id: patientId, volunteer_id: volunteerId, assigned_follow_ups: 2 }, error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await POST(request({ volunteerId }), { params: Promise.resolve({ id: patientId }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, assigned_follow_ups: 2 });
    expect(rpc).toHaveBeenCalledWith("assign_volunteer_to_patient", { p_patient_id: patientId, p_volunteer_id: volunteerId, p_actor_id: actorId });
    expect(mocks.dispatchNotifications).toHaveBeenCalledWith({ recipientProfileId: volunteerId });
  });

  it("maps an invalid volunteer to 422", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.createAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "P0003", message: "volunteer_invalid" } }) });

    const response = await POST(request({ volunteerId }), { params: Promise.resolve({ id: patientId }) });
    expect(response.status).toBe(422);
  });
});
