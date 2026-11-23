import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireClinicalStaff: vi.fn(),
  hasSupabaseAdmin: vi.fn(),
  supabase: { auth: { admin: { createUser: vi.fn() } }, from: vi.fn() }
}));

vi.mock("@/lib/supabase/server", () => ({ requireClinicalStaff: mocks.requireClinicalStaff }));
vi.mock("@/lib/supabase/admin", () => ({ hasSupabaseAdmin: mocks.hasSupabaseAdmin, createAdminClient: vi.fn(() => mocks.supabase) }));

import { POST } from "@/app/api/admin/volunteers/route";

const actorId = "33333333-3333-4333-8333-333333333333";

type Result = { data: unknown; error: unknown };

function builder(resolveTo: () => Result) {
  const b: Record<string, unknown> = {};
  for (const method of ["insert", "select", "single"]) {
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
  return new Request("http://localhost/api/admin/volunteers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasSupabaseAdmin.mockReturnValue(true);
});

describe("POST /api/admin/volunteers", () => {
  it("rejects an unauthenticated caller", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(null);
    expect((await POST(request({ fullName: "อสม. ใหม่" }))).status).toBe(401);
  });

  it("rejects an empty name", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    expect((await POST(request({ fullName: "  " }))).status).toBe(422);
  });

  it("creates an auth user and a volunteer profile", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.supabase.auth.admin.createUser.mockResolvedValue({ data: { user: { id: "v1" } }, error: null });
    mocks.supabase.from.mockImplementation(queueFrom([
      () => ({ data: { id: "v1" }, error: null }),
      () => ({ data: null, error: null })
    ]).from);

    const response = await POST(request({ fullName: "อสม. ใหม่", phone: "0811111111" }));
    expect(response.status).toBe(200);
    expect((await response.json())).toMatchObject({ ok: true, id: "v1" });
    expect(mocks.supabase.auth.admin.createUser).toHaveBeenCalledWith(expect.objectContaining({ email_confirm: true }));
  });

  it("reports a failure when the auth user cannot be created", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.supabase.auth.admin.createUser.mockResolvedValue({ data: null, error: { message: "boom" } });

    const response = await POST(request({ fullName: "อสม. ใหม่" }));
    expect(response.status).toBe(500);
  });
});
