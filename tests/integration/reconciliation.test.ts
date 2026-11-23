import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireClinicalStaff: vi.fn(),
  hasSupabaseAdmin: vi.fn(),
  createAdminClient: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({ requireClinicalStaff: mocks.requireClinicalStaff }));
vi.mock("@/lib/supabase/admin", () => ({ hasSupabaseAdmin: mocks.hasSupabaseAdmin, createAdminClient: mocks.createAdminClient }));

import { POST } from "@/app/api/import/commit/route";

const actorId = "33333333-3333-4333-8333-333333333333";

function serviceResultRequest(csv: string) {
  const file = new File([csv], "results.csv", { type: "text/csv" });
  const formData = {
    get: (key: string) => (key === "kind" ? "service_results" : key === "file" ? file : null)
  };
  const request = { formData: () => Promise.resolve(formData) };
  return request as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasSupabaseAdmin.mockReturnValue(true);
});

describe("POST /api/import/commit (service results)", () => {
  it("rejects an unauthenticated caller", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(null);
    const response = await POST(serviceResultRequest("hn,service_date,clinic,service_result\n001,2026-02-01,ความดัน,มาแล้ว\n"));
    expect(response.status).toBe(401);
  });

  it("rejects a file with validation errors", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    const response = await POST(serviceResultRequest("hn,service_date,clinic,service_result\n001,not-a-date,ความดัน,มาแล้ว\n"));
    expect(response.status).toBe(422);
  });

  it("reconciles service results through the RPC and reports counts", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    const rpc = vi.fn().mockResolvedValue({
      data: { batch_id: "b1", idempotent: false, matched: 1, unmatched: 0, ambiguous: 0 },
      error: null
    });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await POST(serviceResultRequest("hn,service_date,clinic,service_result,external_reference\n001,2026-02-01,ความดัน,มาแล้ว,EXT-1\n"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, matched: 1, unmatched: 0, ambiguous: 0, kind: "service_results" });

    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("commit_service_result_batch");
    expect(args.p_rows[0]).toMatchObject({ hn: "001", service_date: "2026-02-01", external_reference: "EXT-1" });
  });

  it("reports unmatched and ambiguous rows for staff review", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.createAdminClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: { batch_id: "b1", matched: 0, unmatched: 1, ambiguous: 1 }, error: null })
    });

    const response = await POST(serviceResultRequest("hn,service_date,clinic,service_result\n001,2026-02-01,ความดัน,มาแล้ว\n"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ matched: 0, unmatched: 1, ambiguous: 1 });
  });
});
