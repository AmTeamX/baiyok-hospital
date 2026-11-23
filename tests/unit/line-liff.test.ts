import { describe, expect, it } from "vitest";
import { validateLiffClaims, verifyLiffIdToken, LINE_VERIFY_URL, type LiffIdTokenClaims } from "@/lib/line/liff";

const now = new Date("2026-01-01T00:00:00Z").getTime();
const clientId = "1650000000-liff-app";

function claims(overrides: Partial<LiffIdTokenClaims> = {}): LiffIdTokenClaims {
  return {
    iss: "https://access.line.me",
    sub: "U123456789",
    aud: clientId,
    exp: Math.floor(now / 1000) + 3600,
    nonce: "server-nonce",
    ...overrides
  };
}

describe("validateLiffClaims", () => {
  it("accepts a valid set of claims", () => {
    const result = validateLiffClaims(claims(), { clientId, nonce: "server-nonce", nowMs: now });
    expect(result).toEqual({ ok: true, lineUserId: "U123456789", claims: claims() });
  });

  it("rejects a wrong issuer", () => {
    expect(validateLiffClaims(claims({ iss: "https://evil.example" }), { clientId, nonce: "server-nonce", nowMs: now })).toEqual({ ok: false, reason: "invalid_issuer" });
  });

  it("rejects a wrong audience", () => {
    expect(validateLiffClaims(claims({ aud: "another-liff" }), { clientId, nonce: "server-nonce", nowMs: now })).toEqual({ ok: false, reason: "invalid_audience" });
  });

  it("rejects an expired token", () => {
    expect(validateLiffClaims(claims({ exp: Math.floor(now / 1000) - 1 }), { clientId, nonce: "server-nonce", nowMs: now })).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a nonce mismatch (replay/CSRF)", () => {
    expect(validateLiffClaims(claims({ nonce: "different" }), { clientId, nonce: "server-nonce", nowMs: now })).toEqual({ ok: false, reason: "invalid_nonce" });
  });

  it("rejects a missing subject", () => {
    expect(validateLiffClaims(claims({ sub: "" }), { clientId, nonce: "server-nonce", nowMs: now })).toEqual({ ok: false, reason: "missing_sub" });
  });

  it("rejects malformed/null claims", () => {
    expect(validateLiffClaims(null, { clientId, nonce: "server-nonce", nowMs: now })).toEqual({ ok: false, reason: "malformed" });
  });
});

describe("verifyLiffIdToken", () => {
  function mockFetch(status: number, body: unknown) {
    return (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
  }

  it("returns the verified user when LINE accepts the token", async () => {
    const valid = claims({ exp: Math.floor(Date.now() / 1000) + 3600 });
    const result = await verifyLiffIdToken("id-token", clientId, "server-nonce", mockFetch(200, valid));
    expect(result).toEqual({ ok: true, lineUserId: "U123456789", claims: valid });
  });

  it("rejects an invalid signature (LINE returns 400)", async () => {
    const result = await verifyLiffIdToken("bad-token", clientId, "server-nonce", mockFetch(400, { error: "invalid_grant" }));
    expect(result).toEqual({ ok: false, reason: "malformed" });
  });

  it("posts the id_token and client_id to LINE's verify endpoint", async () => {
    let capturedUrl = "";
    let capturedBody = "";
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedBody = String(init?.body);
      return new Response(JSON.stringify(claims()), { status: 200 });
    }) as unknown as typeof fetch;

    await verifyLiffIdToken("id-token", clientId, "server-nonce", fetchImpl);
    expect(capturedUrl).toBe(LINE_VERIFY_URL);
    expect(capturedBody).toContain("id_token=id-token");
    expect(capturedBody).toContain(`client_id=${clientId}`);
  });
});
