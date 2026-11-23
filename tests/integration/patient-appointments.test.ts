import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePatient: vi.fn(),
  createAdminClient: vi.fn()
}));

vi.mock("@/lib/line/patient-auth", () => ({
  requirePatient: mocks.requirePatient,
  patientAuthStatus: (reason: string) =>
    ({ unauthorized: 401, context_required: 403, context_revoked: 403, patient_not_found: 403, database_required: 503 })[reason] ?? 401
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { GET } from "@/app/api/patient/me/appointments/route";

type Result = { data: unknown; error: unknown };

function builder(resolveTo: () => Result) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "gte", "order", "limit", "maybeSingle"]) {
    b[method] = vi.fn(() => b);
  }
  b.then = (onFulfilled: (value: Result) => unknown) => Promise.resolve().then(resolveTo).then(onFulfilled);
  return b;
}

const identity = { patientId: "pat-1", fullName: "นายทดสอบ" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/patient/me/appointments", () => {
  it("rejects an unauthenticated request", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: false, reason: "unauthorized" });
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns the patient's upcoming appointments and past-appointment history", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: true, identity });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => builder(() => ({
        data: [
          { id: "a1", appointment_at: "2026-12-01T08:30:00+07:00", clinic: "คลินิกความดัน", status: "scheduled" },
          { id: "a2", appointment_at: "2026-10-01T08:30:00+07:00", clinic: "คลินิกเบาหวาน", status: "missed" }
        ],
        error: null
      })))
    });

    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json())).toMatchObject({
      ok: true,
      appointments: [{ id: "a1", clinic: "คลินิกความดัน" }],
      history: [{ id: "a2", clinic: "คลินิกเบาหวาน", status: "missed" }]
    });
  });

  it("rejects a revoked context", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: false, reason: "context_revoked" });
    const response = await GET();
    expect(response.status).toBe(403);
  });
});
