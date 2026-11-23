import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireClinicalStaff: vi.fn(),
  hasSupabaseAdmin: vi.fn(),
  supabase: { from: vi.fn() }
}));

vi.mock("@/lib/supabase/server", () => ({ requireClinicalStaff: mocks.requireClinicalStaff }));
vi.mock("@/lib/supabase/admin", () => ({ hasSupabaseAdmin: mocks.hasSupabaseAdmin, createAdminClient: vi.fn(() => mocks.supabase) }));

import { POST } from "@/app/api/admin/line/link-codes/route";

const actorId = "33333333-3333-4333-8333-333333333333";
const patientId = "11111111-1111-4111-8111-111111111111";

type Result = { data: unknown; error: unknown };

function builder(resolveTo: () => Result) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "maybeSingle", "insert"]) {
    b[method] = vi.fn(() => b);
  }
  b.then = (onFulfilled: (value: Result) => unknown) => Promise.resolve().then(resolveTo).then(onFulfilled);
  return b;
}

function queueFrom(results: Array<() => Result>) {
  let index = 0;
  return { from: vi.fn(() => builder(() => results[Math.min(index++, results.length - 1)]())) };
}

function request(body: unknown) {
  return new Request("http://localhost/api/admin/line/link-codes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasSupabaseAdmin.mockReturnValue(true);
});

describe("POST /api/admin/line/link-codes", () => {
  it("does not generate another code for an already linked patient", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.supabase.from.mockImplementation(queueFrom([
      () => ({ data: { id: patientId }, error: null }),
      () => ({ data: { id: "existing-link" }, error: null })
    ]).from);
    const response = await POST(request({ targetType: "patient", targetId: patientId, intendedRole: "patient" }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("already_linked");
    expect(mocks.supabase.from).not.toHaveBeenCalledWith("line_link_codes");
  });
  it("rejects an unauthenticated caller", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(null);
    expect((await POST(request({ targetType: "patient", targetId: patientId, intendedRole: "patient" }))).status).toBe(401);
  });

  it("rejects a role/target mismatch", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    const response = await POST(request({ targetType: "patient", targetId: patientId, intendedRole: "volunteer" }));
    expect(response.status).toBe(422);
  });

  it("creates a one-time code for a patient and returns a token", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.supabase.from.mockImplementation(queueFrom([
      () => ({ data: { id: patientId }, error: null }),
      () => ({ data: null, error: null }),
      () => ({ data: null, error: null })
    ]).from);

    const response = await POST(request({ targetType: "patient", targetId: patientId, intendedRole: "patient" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(typeof body.token).toBe("string");
    expect(body.token).toHaveLength(6);
    expect(body.expiresAt).toBeTruthy();
  });

  it("rejects an invalid volunteer target", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.supabase.from.mockImplementation(queueFrom([() => ({ data: null, error: null })]).from);

    const response = await POST(request({ targetType: "profile", targetId: patientId, intendedRole: "volunteer" }));
    expect(response.status).toBe(422);
  });
});
