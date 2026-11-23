import { describe, expect, it } from "vitest";
import { signPayload, verifyPayload } from "@/lib/line/session";

const secret = "test-secret";

describe("session payload signing", () => {
  it("round-trips a payload", () => {
    const payload = { lineAccountId: "acct-1", lineUserId: "U123", exp: Math.floor(Date.now() / 1000) + 60 };
    const token = signPayload(payload, secret);
    expect(verifyPayload(token, secret)).toEqual(payload);
  });

  it("rejects a tampered payload", () => {
    const token = signPayload({ lineAccountId: "acct-1" }, secret);
    const tampered = `${Buffer.from(JSON.stringify({ lineAccountId: "acct-2" })).toString("base64url")}.${token.slice(token.lastIndexOf(".") + 1)}`;
    expect(verifyPayload(tampered, secret)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = signPayload({ lineAccountId: "acct-1" }, secret);
    expect(verifyPayload(token, "other-secret")).toBeNull();
  });

  it("rejects an expired payload", () => {
    const token = signPayload({ exp: Math.floor(Date.now() / 1000) - 1 }, secret);
    expect(verifyPayload(token, secret)).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(verifyPayload("garbage", secret)).toBeNull();
  });
});
