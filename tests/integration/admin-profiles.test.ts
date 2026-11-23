import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireClinicalStaff: vi.fn(),
  hasSupabaseAdmin: vi.fn(),
  createAdminClient: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({ requireClinicalStaff: mocks.requireClinicalStaff }));
vi.mock("@/lib/supabase/admin", () => ({ hasSupabaseAdmin: mocks.hasSupabaseAdmin, createAdminClient: mocks.createAdminClient }));

import { GET } from "@/app/api/admin/profiles/route";

type Result = { data: unknown; error: unknown };

function builder(resolveTo: () => Result) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order"]) {
    b[method] = vi.fn(() => b);
  }
  b.then = (onFulfilled: (value: Result) => unknown) => Promise.resolve().then(resolveTo).then(onFulfilled);
  return b;
}

function queueFrom(results: Array<() => Result>) {
  let index = 0;
  return { from: vi.fn(() => builder(() => results[Math.min(index++, results.length - 1)]())) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasSupabaseAdmin.mockReturnValue(true);
});

describe("GET /api/admin/profiles", () => {
  it("rejects an unauthenticated caller", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("returns staff and volunteers scoped to the service unit", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: "u1", serviceUnitId: "unit-1" });
    mocks.createAdminClient.mockReturnValue(queueFrom([
      () => ({
        data: [
          { id: "v1", full_name: "อสม. มาลี", role: "volunteer", active: true, phone: null },
          { id: "n1", full_name: "พยาบาล กนก", role: "nurse", active: true, phone: "0811111111" }
        ],
        error: null
      }),
      () => ({ data: [{ profile_id: "v1", status: "active" }], error: null })
    ]));

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profiles).toHaveLength(2);
    expect(body.profiles[0]).toMatchObject({ role: "volunteer", line_linked: true });
  });

  it("returns an empty list in demo mode", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "demo", userId: null, serviceUnitId: null });
    mocks.hasSupabaseAdmin.mockReturnValue(false);
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json())).toMatchObject({ ok: true, mode: "demo", profiles: [] });
  });
});
