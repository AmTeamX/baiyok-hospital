import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn()
  },
  verifyLiffIdToken: vi.fn(),
  cookieStore: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock("@/lib/supabase/admin", () => ({
  hasSupabaseAdmin: vi.fn(() => true),
  createAdminClient: vi.fn(() => mocks.supabase)
}));

vi.mock("@/lib/line/liff", () => ({
  verifyLiffIdToken: mocks.verifyLiffIdToken
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mocks.cookieStore)
}));

import { POST } from "@/app/api/line/link/verify/route";

type Result = { data: unknown; error: unknown };

function makeBuilder(result: Result) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    upsert: () => builder,
    insert: () => builder,
    update: () => builder,
    eq: () => builder,
    maybeSingle: async () => result,
    single: async () => result,
    then: (resolve: (value: Result) => unknown) => resolve(result)
  };
  return builder;
}

function queueResults(queues: Record<string, Result[]>) {
  mocks.supabase.from.mockImplementation((table: string) => {
    const list = queues[table] ?? [];
    const result = list.length ? list.shift()! : { data: null, error: null };
    return makeBuilder(result);
  });
}

const validBody = () => ({ idToken: "id-token", code: "raw-code", nonce: "server-nonce", role: "patient" });

function request(body: unknown) {
  return new Request("http://localhost/api/line/link/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_LIFF_ID = "liff-id";
  process.env.LIFF_SESSION_SECRET = "test-secret";
  delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
  delete process.env.LINE_RICH_MENU_PATIENT_ID;
  delete process.env.LINE_RICH_MENU_VOLUNTEER_ID;
  delete process.env.LINE_RICH_MENU_MULTIROLE_ID;
  delete process.env.LINE_RICH_MENU_DEFAULT_ID;
  mocks.verifyLiffIdToken.mockResolvedValue({ ok: true, lineUserId: "U123", claims: { iss: "https://access.line.me", sub: "U123", aud: "liff-id", exp: 9999999999 } });
  mocks.cookieStore.get.mockReturnValue({ value: "server-nonce" });
});

describe("POST /api/line/link/verify", () => {
  it("links a patient on the happy path and sets a session", async () => {
    mocks.supabase.rpc.mockResolvedValue({
      data: { target_type: "patient", target_id: "p-1", intended_role: "patient" },
      error: null
    });
    queueResults({
      patients: [{ data: { id: "p-1" }, error: null }],
      line_accounts: [{ data: { id: "acct-1" }, error: null }],
      line_account_links: [{ data: null, error: null }, { data: [{ role: "patient" }], error: null }],
      audit_logs: [{ data: null, error: null }]
    });

    const response = await POST(request(validBody()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.role).toBe("patient");
    expect(mocks.supabase.rpc).toHaveBeenCalledWith("consume_line_link_code", {
      p_token_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      p_claimed_role: "patient"
    });
    expect(mocks.cookieStore.set).toHaveBeenCalled();
  });

  it("rejects a reused link code", async () => {
    mocks.supabase.rpc.mockResolvedValue({ data: null, error: { code: "LLC01", message: "LINE_LINK_CODE_USED" } });

    const response = await POST(request(validBody()));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("link_code_used");
  });

  it("rejects an expired link code", async () => {
    mocks.supabase.rpc.mockResolvedValue({ data: null, error: { code: "LLC02", message: "LINE_LINK_CODE_EXPIRED" } });

    const response = await POST(request(validBody()));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("link_code_expired");
  });

  it("rejects a wrong-target claim (client role mismatches the code)", async () => {
    mocks.supabase.rpc.mockResolvedValue({ data: null, error: { code: "LLC04", message: "LINE_LINK_CODE_WRONG_TARGET" } });

    const response = await POST(request({ ...validBody(), role: "volunteer" }));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("link_code_wrong_target");
  });

  it("rejects an invalid ID token", async () => {
    mocks.verifyLiffIdToken.mockResolvedValue({ ok: false, reason: "invalid_audience" });

    const response = await POST(request(validBody()));
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("invalid_audience");
    expect(mocks.supabase.rpc).not.toHaveBeenCalled();
  });

  it("rejects a replayed nonce", async () => {
    mocks.cookieStore.get.mockReturnValue(undefined);

    const response = await POST(request(validBody()));
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("invalid_nonce");
    expect(mocks.verifyLiffIdToken).not.toHaveBeenCalled();
  });

  it("rejects a missing role (role is never derived from the request body alone)", async () => {
    const response = await POST(request({ idToken: "id-token", code: "raw-code", nonce: "server-nonce" }));
    expect(response.status).toBe(422);
  });
});
