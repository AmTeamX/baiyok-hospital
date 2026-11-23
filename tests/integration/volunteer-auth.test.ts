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

import { requireVolunteer } from "@/lib/line/volunteer-auth";

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
const volunteerContext = { linkId: "link-1", lineAccountId: "acct-1", role: "volunteer", exp: 9999999999 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasSupabaseAdmin.mockReturnValue(true);
});

describe("requireVolunteer", () => {
  it("returns the identity for an active volunteer link", async () => {
    mocks.readSession.mockResolvedValue(session);
    mocks.readContext.mockResolvedValue(volunteerContext);
    const calls = [
      () => ({ data: { id: "link-1", profile_id: "vol-1", status: "active" }, error: null }),
      () => ({ data: { id: "vol-1", full_name: "อสม. มาลี", active: true, service_unit_id: "unit-1" }, error: null })
    ];
    let index = 0;
    mocks.supabase.from.mockImplementation(() => makeBuilder(calls[Math.min(index++, calls.length - 1)]()));

    const result = await requireVolunteer();
    expect(result).toEqual({ ok: true, identity: { profileId: "vol-1", fullName: "อสม. มาลี", serviceUnitId: "unit-1" } });
  });

  it("rejects a missing session", async () => {
    mocks.readSession.mockResolvedValue(null);
    expect(await requireVolunteer()).toEqual({ ok: false, reason: "unauthorized" });
  });

  it("rejects a missing or non-volunteer context", async () => {
    mocks.readSession.mockResolvedValue(session);
    mocks.readContext.mockResolvedValue(null);
    expect(await requireVolunteer()).toEqual({ ok: false, reason: "context_required" });

    mocks.readContext.mockResolvedValue({ ...volunteerContext, role: "patient" });
    expect(await requireVolunteer()).toEqual({ ok: false, reason: "context_required" });
  });

  it("rejects a context bound to a different account", async () => {
    mocks.readSession.mockResolvedValue(session);
    mocks.readContext.mockResolvedValue({ ...volunteerContext, lineAccountId: "other" });
    expect(await requireVolunteer()).toEqual({ ok: false, reason: "unauthorized" });
  });

  it("rejects a revoked or missing link", async () => {
    mocks.readSession.mockResolvedValue(session);
    mocks.readContext.mockResolvedValue(volunteerContext);

    mocks.supabase.from.mockImplementation(() => makeBuilder({ data: { id: "link-1", profile_id: "vol-1", status: "revoked" }, error: null }));
    expect(await requireVolunteer()).toEqual({ ok: false, reason: "context_revoked" });

    mocks.supabase.from.mockImplementation(() => makeBuilder({ data: null, error: null }));
    expect(await requireVolunteer()).toEqual({ ok: false, reason: "context_revoked" });
  });

  it("rejects a non-volunteer profile", async () => {
    mocks.readSession.mockResolvedValue(session);
    mocks.readContext.mockResolvedValue(volunteerContext);
    const calls = [
      () => ({ data: { id: "link-1", profile_id: "vol-1", status: "active" }, error: null }),
      () => ({ data: null, error: null })
    ];
    let index = 0;
    mocks.supabase.from.mockImplementation(() => makeBuilder(calls[Math.min(index++, calls.length - 1)]()));

    expect(await requireVolunteer()).toEqual({ ok: false, reason: "not_volunteer" });
  });

  it("rejects an inactive volunteer", async () => {
    mocks.readSession.mockResolvedValue(session);
    mocks.readContext.mockResolvedValue(volunteerContext);
    const calls = [
      () => ({ data: { id: "link-1", profile_id: "vol-1", status: "active" }, error: null }),
      () => ({ data: { id: "vol-1", full_name: "อสม. มาลี", active: false, service_unit_id: "unit-1" }, error: null })
    ];
    let index = 0;
    mocks.supabase.from.mockImplementation(() => makeBuilder(calls[Math.min(index++, calls.length - 1)]()));

    expect(await requireVolunteer()).toEqual({ ok: false, reason: "inactive" });
  });
});
