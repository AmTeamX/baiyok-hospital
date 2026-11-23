import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readSession: vi.fn(),
  readContext: vi.fn(),
  hasSupabaseAdmin: vi.fn(),
  supabase: { from: vi.fn() }
}));

vi.mock("@/lib/line/session", () => ({ readSession: mocks.readSession, readContext: mocks.readContext }));
vi.mock("@/lib/supabase/admin", () => ({
  hasSupabaseAdmin: mocks.hasSupabaseAdmin,
  createAdminClient: vi.fn(() => mocks.supabase)
}));

import { requirePatient } from "@/lib/line/patient-auth";

type Result = { data: unknown; error: unknown };

function makeBuilder(result: Result) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => builder,
    then: (resolve: (value: Result) => unknown) => resolve(result)
  };
  return builder;
}

const session = { lineAccountId: "acct-1", lineUserId: "U123", exp: 9999999999 };
const patientContext = { linkId: "link-1", lineAccountId: "acct-1", role: "patient", exp: 9999999999 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasSupabaseAdmin.mockReturnValue(true);
});

describe("requirePatient", () => {
  it("resolves the patient from an active link", async () => {
    mocks.readSession.mockResolvedValue(session);
    mocks.readContext.mockResolvedValue(patientContext);
    const calls = [
      () => ({ data: { id: "link-1", patient_id: "pat-1", status: "active" }, error: null }),
      () => ({ data: { id: "pat-1", full_name: "นายทดสอบ" }, error: null })
    ];
    let index = 0;
    mocks.supabase.from.mockImplementation(() => makeBuilder(calls[Math.min(index++, calls.length - 1)]()));

    expect(await requirePatient()).toEqual({ ok: true, identity: { patientId: "pat-1", fullName: "นายทดสอบ" } });
  });

  it("rejects a missing session", async () => {
    mocks.readSession.mockResolvedValue(null);
    expect(await requirePatient()).toEqual({ ok: false, reason: "unauthorized" });
  });

  it("rejects a missing or non-patient context", async () => {
    mocks.readSession.mockResolvedValue(session);
    mocks.readContext.mockResolvedValue(null);
    expect(await requirePatient()).toEqual({ ok: false, reason: "context_required" });

    mocks.readContext.mockResolvedValue({ ...patientContext, role: "volunteer" });
    expect(await requirePatient()).toEqual({ ok: false, reason: "context_required" });
  });

  it("rejects a revoked link", async () => {
    mocks.readSession.mockResolvedValue(session);
    mocks.readContext.mockResolvedValue(patientContext);
    mocks.supabase.from.mockImplementation(() => makeBuilder({ data: { id: "link-1", patient_id: "pat-1", status: "revoked" }, error: null }));
    expect(await requirePatient()).toEqual({ ok: false, reason: "context_revoked" });
  });

  it("rejects a missing patient", async () => {
    mocks.readSession.mockResolvedValue(session);
    mocks.readContext.mockResolvedValue(patientContext);
    const calls = [
      () => ({ data: { id: "link-1", patient_id: "pat-1", status: "active" }, error: null }),
      () => ({ data: null, error: null })
    ];
    let index = 0;
    mocks.supabase.from.mockImplementation(() => makeBuilder(calls[Math.min(index++, calls.length - 1)]()));
    expect(await requirePatient()).toEqual({ ok: false, reason: "patient_not_found" });
  });
});
