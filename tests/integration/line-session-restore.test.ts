import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), consume: vi.fn(), setSession: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/line/liff", () => ({ verifyLiffIdToken: mocks.verify }));
vi.mock("@/lib/line/session", () => ({ consumeNonce: mocks.consume, getSessionSecret: () => "configured", setSessionCookie: mocks.setSession, LIFF_SESSION_TTL_SECONDS: 86400 }));
vi.mock("@/lib/supabase/admin", () => ({ hasSupabaseAdmin: () => true, createAdminClient: () => ({ from: mocks.from }) }));
import { POST } from "@/app/api/line/me/session/route";

function result(data: unknown, error: unknown = null) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) builder[method] = vi.fn(() => builder);
  builder.maybeSingle = async () => ({ data, error });
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve);
  return builder;
}
function request() { return new Request("https://app.example/api/line/me/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken: "verified-token", nonce: "nonce" }) }); }
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_LIFF_ID", "123-app");
  mocks.consume.mockResolvedValue(true);
  mocks.verify.mockResolvedValue({ ok: true, lineUserId: "U1" });
  mocks.setSession.mockResolvedValue(true);
  mocks.from.mockImplementation((table) => table === "line_accounts" ? result({ id: "account-1" }) : result([
    { id: "volunteer-link", line_account_id: "account-1", role: "volunteer", status: "active" },
    { id: "revoked-link", line_account_id: "account-1", role: "patient", status: "revoked" }
  ]));
});
describe("restore an existing LINE session", () => {
  it("verifies the token and restores only active roles without another linking code", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).contexts).toEqual([{ linkId: "volunteer-link", role: "volunteer" }]);
    expect(mocks.verify).toHaveBeenCalledWith("verified-token", "123");
    expect(mocks.setSession).toHaveBeenCalledWith(expect.objectContaining({ lineAccountId: "account-1", lineUserId: "U1" }));
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["line_accounts", "line_account_links"]);
  });
  it("rejects a replayed nonce before looking up accounts", async () => {
    mocks.consume.mockResolvedValue(false);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.setSession).not.toHaveBeenCalled();
  });
  it("rejects invalid identity tokens", async () => {
    mocks.verify.mockResolvedValue({ ok: false, reason: "invalid_audience" });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not create an account for an unknown LINE identity", async () => {
    mocks.from.mockReturnValue(result(null));
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("account_not_linked");
    expect(mocks.setSession).not.toHaveBeenCalled();
  });
  it("does not misreport database failures as an unlinked account", async () => {
    mocks.from.mockReturnValue(result(null, { message: "offline" }));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe("query_failed");
  });
});
