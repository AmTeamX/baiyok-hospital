import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireClinicalStaff: vi.fn(),
  hasSupabaseAdmin: vi.fn(),
  supabase: { from: vi.fn() }
}));

vi.mock("@/lib/supabase/server", () => ({ requireClinicalStaff: mocks.requireClinicalStaff }));
vi.mock("@/lib/supabase/admin", () => ({ hasSupabaseAdmin: mocks.hasSupabaseAdmin, createAdminClient: vi.fn(() => mocks.supabase) }));

import { POST } from "@/app/api/patients/route";

const actorId = "33333333-3333-4333-8333-333333333333";

type Result = { data: unknown; error: unknown };

function builder(resolveTo: () => Result) {
  const b: Record<string, unknown> = {};
  for (const method of ["upsert", "insert", "select", "single", "eq"]) {
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
  return new Request("http://localhost/api/patients", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

const validBody = { hn: "00123", fullName: "นายทดสอบ", appointmentDate: "2026-12-01", appointmentTime: "08:30", clinic: "คลินิกความดัน" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasSupabaseAdmin.mockReturnValue(true);
});

describe("POST /api/patients", () => {
  it("rejects an unauthenticated caller", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(null);
    expect((await POST(request(validBody))).status).toBe(401);
  });

  it("rejects missing required fields", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    expect((await POST(request({ hn: "00123" }))).status).toBe(422);
  });

  it("rejects an invalid date", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    expect((await POST(request({ ...validBody, appointmentDate: "not-a-date" }))).status).toBe(422);
  });

  it("upserts a patient and creates an appointment", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.supabase.from.mockImplementation(queueFrom([
      () => ({ data: { id: "pat-1" }, error: null }),
      () => ({ data: { id: "appt-1" }, error: null }),
      () => ({ data: null, error: null })
    ]).from);

    const response = await POST(request(validBody));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, patientId: "pat-1", appointmentId: "appt-1" });
  });

  it("reports a duplicate appointment as 409", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.supabase.from.mockImplementation(queueFrom([
      () => ({ data: { id: "pat-1" }, error: null }),
      () => ({ data: null, error: { code: "23505", message: "duplicate key" } })
    ]).from);

    const response = await POST(request(validBody));
    expect(response.status).toBe(409);
  });

  it("creates a missed appointment and a pending follow-up when status is missed", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.supabase.from.mockImplementation(queueFrom([
      () => ({ data: { id: "pat-1" }, error: null }),
      () => ({ data: { id: "appt-1" }, error: null }),
      () => ({ data: null, error: null }),
      () => ({ data: null, error: null })
    ]).from);

    const response = await POST(request({ ...validBody, appointmentDate: "2020-01-01", status: "missed" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, status: "missed" });
  });
});
