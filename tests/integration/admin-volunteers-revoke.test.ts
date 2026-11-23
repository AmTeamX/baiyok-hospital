import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireClinicalStaff: vi.fn(),
  hasSupabaseAdmin: vi.fn(),
  createAdminClient: vi.fn(),
  unlinkRichMenuFromUser: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({ requireClinicalStaff: mocks.requireClinicalStaff }));
vi.mock("@/lib/supabase/admin", () => ({ hasSupabaseAdmin: mocks.hasSupabaseAdmin, createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/line/rich-menu", () => ({ unlinkRichMenuFromUser: mocks.unlinkRichMenuFromUser }));

import { POST } from "@/app/api/admin/volunteers/[id]/revoke/route";

const actorId = "33333333-3333-4333-8333-333333333333";
const volunteerId = "22222222-2222-4222-8222-222222222222";

type Result = { data: unknown; error: unknown };

function builder(resolveTo: () => Result) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "maybeSingle", "single", "update", "insert"]) {
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
  delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
});

describe("POST /api/admin/volunteers/[id]/revoke", () => {
  it("rejects an unauthenticated caller", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(null);
    expect((await POST(new Request("http://localhost/x"), { params: Promise.resolve({ id: volunteerId }) })).status).toBe(401);
  });

  it("returns revoked=false when there is no active link", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.createAdminClient.mockReturnValue(queueFrom([() => ({ data: null, error: null })]));

    const response = await POST(new Request("http://localhost/x"), { params: Promise.resolve({ id: volunteerId }) });
    expect(response.status).toBe(200);
    expect((await response.json())).toMatchObject({ ok: true, revoked: false });
  });

  it("revokes the active link and audits it", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.createAdminClient.mockReturnValue(queueFrom([
      () => ({ data: { id: "link-1", line_account_id: "la1" }, error: null }),
      () => ({ data: null, error: null }),
      () => ({ data: { line_user_id: "U123" }, error: null }),
      () => ({ data: null, error: null })
    ]));

    const response = await POST(new Request("http://localhost/x"), { params: Promise.resolve({ id: volunteerId }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, revoked: true });
  });
});
