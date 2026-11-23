import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireClinicalStaff: vi.fn(),
  hasSupabaseAdmin: vi.fn(),
  createAdminClient: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({ requireClinicalStaff: mocks.requireClinicalStaff }));
vi.mock("@/lib/supabase/admin", () => ({ hasSupabaseAdmin: mocks.hasSupabaseAdmin, createAdminClient: mocks.createAdminClient }));

import { GET } from "@/app/api/requests/route";
import { PATCH } from "@/app/api/requests/[id]/route";

const actorId = "33333333-3333-4333-8333-333333333333";
const requestId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasSupabaseAdmin.mockReturnValue(true);
});

describe("GET /api/requests", () => {
  it("rejects an unauthenticated caller", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/requests"))).status).toBe(401);
  });

  it("returns requests scoped to the service unit", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    const rpc = vi.fn().mockResolvedValue({
      data: { rows: [{ id: requestId, request_type: "consult", reason_code: "medication", status: "new", patient_name: "นายทดสอบ", assignee_name: null }] },
      error: null
    });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await GET(new Request("http://localhost/api/requests"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.requests[0]).toMatchObject({ patientName: "นายทดสอบ", statusLabel: "ใหม่" });
    expect(rpc).toHaveBeenCalledWith("search_patient_requests", expect.objectContaining({ p_service_unit_id: "unit-1" }));
  });
});

describe("PATCH /api/requests/[id]", () => {
  const params = Promise.resolve({ id: requestId });

  function request(body: unknown) {
    return new Request("http://localhost/api/requests/x", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  it("rejects an unauthenticated caller", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(null);
    expect((await PATCH(request({ status: "acknowledged" }), { params })).status).toBe(401);
  });

  it("rejects an invalid status", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    expect((await PATCH(request({ status: "bogus" }), { params })).status).toBe(422);
  });

  it("transitions via the RPC", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    const rpc = vi.fn().mockResolvedValue({ data: { request_id: requestId, status: "resolved" }, error: null });
    const requestBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
    };
    mocks.createAdminClient.mockReturnValue({ rpc, from: vi.fn(() => requestBuilder) });

    const response = await PATCH(request({ status: "resolved" }), { params });
    expect(response.status).toBe(200);
    expect((await response.json())).toMatchObject({ ok: true, status: "resolved" });
  });

  it("maps a forbidden transition to 403", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.createAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "42501", message: "forbidden" } }) });

    const response = await PATCH(request({ status: "resolved" }), { params });
    expect(response.status).toBe(403);
  });
});
