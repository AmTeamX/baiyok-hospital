import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readSession: vi.fn(),
  setContextCookie: vi.fn(),
  supabase: { from: vi.fn() }
}));

vi.mock("@/lib/line/session", () => ({
  readSession: mocks.readSession,
  setContextCookie: mocks.setContextCookie
}));

vi.mock("@/lib/supabase/admin", () => ({
  hasSupabaseAdmin: vi.fn(() => true),
  createAdminClient: vi.fn(() => mocks.supabase)
}));

import { GET as getContexts } from "@/app/api/line/me/contexts/route";
import { POST as setContext } from "@/app/api/line/me/context/route";

type Result = { data: unknown; error: unknown };

function makeBuilder(result: Result) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    then: (resolve: (value: Result) => unknown) => resolve(result)
  };
  return builder;
}

function withLinks(links: unknown[]) {
  mocks.supabase.from.mockImplementation(() => makeBuilder({ data: links, error: null }));
}

const session = { lineAccountId: "acct-1", lineUserId: "U123", exp: 9999999999 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readSession.mockResolvedValue(session);
  mocks.setContextCookie.mockResolvedValue(true);
});

describe("GET /api/line/me/contexts", () => {
  it("returns only active links for the account", async () => {
    withLinks([
      { id: "link-1", line_account_id: "acct-1", role: "patient", status: "active" },
      { id: "link-2", line_account_id: "acct-1", role: "volunteer", status: "active" },
      { id: "link-3", line_account_id: "acct-1", role: "patient", status: "revoked" }
    ]);

    const response = await getContexts();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.contexts).toEqual([
      { linkId: "link-1", role: "patient" },
      { linkId: "link-2", role: "volunteer" }
    ]);
  });

  it("rejects an unauthenticated request", async () => {
    mocks.readSession.mockResolvedValue(null);
    const response = await getContexts();
    expect(response.status).toBe(401);
  });
});

describe("POST /api/line/me/context", () => {
  function request(body: unknown) {
    return new Request("http://localhost/api/line/me/context", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  it("sets a context when the link is active", async () => {
    withLinks([{ id: "link-1", line_account_id: "acct-1", role: "patient", status: "active" }]);

    const response = await setContext(request({ linkId: "link-1", role: "patient" }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.role).toBe("patient");
    expect(mocks.setContextCookie).toHaveBeenCalled();
  });

  it("rejects a context whose link has been revoked", async () => {
    withLinks([{ id: "link-1", line_account_id: "acct-1", role: "patient", status: "revoked" }]);

    const response = await setContext(request({ linkId: "link-1", role: "patient" }));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("context_revoked");
    expect(mocks.setContextCookie).not.toHaveBeenCalled();
  });

  it("rejects a mismatched role", async () => {
    withLinks([{ id: "link-1", line_account_id: "acct-1", role: "patient", status: "active" }]);

    const response = await setContext(request({ linkId: "link-1", role: "volunteer" }));
    expect(response.status).toBe(403);
  });
});
