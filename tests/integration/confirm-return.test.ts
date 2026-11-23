import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireClinicalStaff: vi.fn(),
  hasSupabaseAdmin: vi.fn(),
  createAdminClient: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({ requireClinicalStaff: mocks.requireClinicalStaff }));
vi.mock("@/lib/supabase/admin", () => ({ hasSupabaseAdmin: mocks.hasSupabaseAdmin, createAdminClient: mocks.createAdminClient }));

import { POST } from "@/app/api/follow-ups/[id]/confirm-return/route";

const followUpId = "11111111-1111-4111-8111-111111111111";
const actorId = "33333333-3333-4333-8333-333333333333";
const params = Promise.resolve({ id: followUpId });

function request(body: unknown) {
  return new Request("http://localhost/api/follow-ups/x/confirm-return", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasSupabaseAdmin.mockReturnValue(true);
});

describe("POST /api/follow-ups/[id]/confirm-return", () => {
  it("rejects an unauthenticated caller", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(null);
    const response = await POST(request({ expectedVersion: 1 }), { params });
    expect(response.status).toBe(401);
  });

  it("requires a version", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    const response = await POST(request({}), { params });
    expect(response.status).toBe(422);
  });

  it("confirms a return via the RPC", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    const rpc = vi.fn().mockResolvedValue({ data: { follow_up_id: followUpId, version: 2, status: "returned" }, error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await POST(request({ note: "มารับบริการแล้ว", expectedVersion: 1 }), { params });
    expect(response.status).toBe(200);
    expect((await response.json())).toMatchObject({ ok: true, status: "returned", version: 2 });
    expect(rpc).toHaveBeenCalledWith("confirm_return_manually", expect.objectContaining({ p_follow_up_id: followUpId, p_actor_id: actorId, p_expected_version: 1 }));
  });

  it("maps a stale version to 409", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.createAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "P0004", message: "version_conflict" } }) });

    const response = await POST(request({ expectedVersion: 1 }), { params });
    expect(response.status).toBe(409);
  });

  it("maps a forbidden actor to 403", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.createAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "42501", message: "forbidden" } }) });

    const response = await POST(request({ expectedVersion: 1 }), { params });
    expect(response.status).toBe(403);
  });
});
