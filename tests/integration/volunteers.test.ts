import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireClinicalStaff: vi.fn(),
  hasSupabaseAdmin: vi.fn(),
  createAdminClient: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({ requireClinicalStaff: mocks.requireClinicalStaff }));
vi.mock("@/lib/supabase/admin", () => ({ hasSupabaseAdmin: mocks.hasSupabaseAdmin, createAdminClient: mocks.createAdminClient }));

import { GET } from "@/app/api/volunteers/route";
import { PATCH } from "@/app/api/volunteers/[id]/route";

const volunteerId = "22222222-2222-4222-8222-222222222222";

function chainable<T>(resolveTo: () => T) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "update", "insert", "single", "maybeSingle"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (onFulfilled: (value: T) => unknown, onRejected: (error: unknown) => unknown) =>
    Promise.resolve().then(resolveTo).then(onFulfilled, onRejected);
  return builder;
}

function queueSupabase(results: Array<() => unknown>) {
  let index = 0;
  return { from: vi.fn(() => chainable(() => results[Math.min(index++, results.length - 1)]())) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/volunteers", () => {
  it("rejects unauthenticated callers", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns demo volunteers when Supabase is not configured", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "demo", userId: null, serviceUnitId: null });
    mocks.hasSupabaseAdmin.mockReturnValue(false);
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.mode).toBe("demo");
    expect(body.volunteers.length).toBeGreaterThan(0);
    expect(body.volunteers[0].active).toBe(true);
  });

  it("returns volunteers from the staff service unit", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: "u1", serviceUnitId: "unit-1" });
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    mocks.createAdminClient.mockReturnValue(queueSupabase([
      () => ({ data: [{ id: volunteerId, full_name: "อสม. มาลี", active: true, phone: null }], error: null })
    ]));

    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.mode).toBe("database");
    expect(body.volunteers).toHaveLength(1);
  });
});

describe("PATCH /api/volunteers/[id]", () => {
  it("rejects unauthenticated callers", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(null);
    const response = await PATCH(new Request("http://localhost/api/volunteers/x", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: false }) }), { params: Promise.resolve({ id: volunteerId }) });
    expect(response.status).toBe(401);
  });

  it("rejects a body without an explicit active flag", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: "u1", serviceUnitId: "unit-1" });
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    const response = await PATCH(new Request("http://localhost/api/volunteers/x", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({}) }), { params: Promise.resolve({ id: volunteerId }) });
    expect(response.status).toBe(422);
  });

  it("refuses to manage a volunteer outside the service unit", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: "u1", serviceUnitId: "unit-1" });
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    mocks.createAdminClient.mockReturnValue(queueSupabase([
      () => ({ data: { id: volunteerId, role: "volunteer", service_unit_id: "unit-OTHER" }, error: null })
    ]));

    const response = await PATCH(new Request("http://localhost/api/volunteers/x", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: false }) }), { params: Promise.resolve({ id: volunteerId }) });
    expect(response.status).toBe(403);
  });

  it("toggles the active flag and writes an audit event", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: "u1", serviceUnitId: "unit-1" });
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    const supabase = queueSupabase([
      () => ({ data: { id: volunteerId, role: "volunteer", service_unit_id: "unit-1" }, error: null }),
      () => ({ data: null, error: null }),
      () => ({ data: null, error: null })
    ]);
    mocks.createAdminClient.mockReturnValue(supabase);

    const response = await PATCH(new Request("http://localhost/api/volunteers/x", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: false }) }), { params: Promise.resolve({ id: volunteerId }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, active: false });
  });
});
