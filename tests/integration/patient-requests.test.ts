import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePatient: vi.fn(),
  supabase: { from: vi.fn(), rpc: vi.fn() }
}));

vi.mock("@/lib/line/patient-auth", () => ({
  requirePatient: mocks.requirePatient,
  patientAuthStatus: (reason: string) =>
    ({ unauthorized: 401, context_required: 403, context_revoked: 403, patient_not_found: 403, database_required: 503 })[reason] ?? 401
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => mocks.supabase) }));

import { GET, POST } from "@/app/api/patient/me/requests/route";

type Result = { data: unknown; error: unknown };

function builder(resolveTo: () => Result) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit", "insert", "single", "maybeSingle"]) {
    b[method] = vi.fn(() => b);
  }
  b.then = (onFulfilled: (value: Result) => unknown) => Promise.resolve().then(resolveTo).then(onFulfilled);
  return b;
}

const identity = { patientId: "pat-1", fullName: "นายทดสอบ" };

function request(body: unknown) {
  return new Request("http://localhost/api/patient/me/requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/patient/me/requests", () => {
  it("rejects an unauthenticated request", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: false, reason: "unauthorized" });
    expect((await GET()).status).toBe(401);
  });

  it("returns the patient's requests with Thai labels", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: true, identity });
    mocks.supabase.from.mockReturnValue(builder(() => ({
      data: [{ id: "r1", request_type: "problem", reason_code: "travel_difficulty", note: null, status: "new", created_at: "2026-11-24T00:00:00Z", resolved_at: null }],
      error: null
    })));

    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.requests[0]).toMatchObject({ reasonLabel: "เดินทางไม่สะดวก", statusLabel: "ใหม่" });
  });
});

describe("POST /api/patient/me/requests", () => {
  it("creates a valid request and audits it", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: true, identity });
    mocks.supabase.from.mockReturnValue(builder(() => ({ data: { id: "r1" }, error: null })));

    const response = await POST(request({ requestType: "problem", reasonCode: "travel_difficulty", note: "ไม่มีรถไป" }));
    expect(response.status).toBe(200);
    expect((await response.json())).toMatchObject({ ok: true, id: "r1", status: "new" });
    expect(mocks.supabase.from).toHaveBeenCalledWith("patient_requests");
  });

  it("rejects an invalid request type", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: true, identity });
    const response = await POST(request({ requestType: "bogus", reasonCode: "travel_difficulty" }));
    expect(response.status).toBe(422);
  });

  it("rejects a reason that does not match the type", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: true, identity });
    const response = await POST(request({ requestType: "problem", reasonCode: "medication" }));
    expect(response.status).toBe(422);
  });

  it("rejects an appointment that does not belong to the patient", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: true, identity });
    mocks.supabase.from.mockReturnValue(builder(() => ({ data: null, error: null })));
    const response = await POST(request({
      requestType: "problem",
      reasonCode: "travel_difficulty",
      appointmentId: "11111111-1111-4111-8111-111111111111"
    }));
    expect(response.status).toBe(422);
  });

  it("rejects an unauthenticated request", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: false, reason: "unauthorized" });
    expect((await POST(request({ requestType: "problem", reasonCode: "travel_difficulty" }))).status).toBe(401);
  });
});
