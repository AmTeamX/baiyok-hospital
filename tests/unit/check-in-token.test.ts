import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { CHECKIN_TOKEN_TTL_SECONDS, signCheckInToken, verifyCheckInToken } from "@/lib/check-in-token";

const secret = "test-checkin-secret";

function makeToken(payload: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

beforeEach(() => {
  process.env.CHECKIN_SIGNING_SECRET = secret;
});

describe("check-in token", () => {
  it("round-trips a signed token", () => {
    const token = signCheckInToken("appt-1");
    const verified = verifyCheckInToken(token);
    expect(verified).toMatchObject({ appointmentId: "appt-1" });
    expect(verified?.nonce).toBeTruthy();
  });

  it("rejects a tampered payload", () => {
    const token = signCheckInToken("appt-1");
    const body = token.slice(0, token.lastIndexOf("."));
    const forged = Buffer.from(JSON.stringify({ purpose: "check_in", appointmentId: "appt-2", exp: Math.floor(Date.now() / 1000) + 60, nonce: "x" })).toString("base64url");
    expect(verifyCheckInToken(`${forged}.${token.slice(token.lastIndexOf(".") + 1)}`)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = signCheckInToken("appt-1");
    process.env.CHECKIN_SIGNING_SECRET = "other-secret";
    expect(verifyCheckInToken(token)).toBeNull();
    process.env.CHECKIN_SIGNING_SECRET = secret;
  });

  it("rejects an expired token", () => {
    const nowMs = Date.parse("2026-11-24T12:00:00.000Z");
    const token = signCheckInToken("appt-1", { nowMs });
    expect(verifyCheckInToken(token, { nowMs: nowMs + CHECKIN_TOKEN_TTL_SECONDS * 1000 + 1 })).toBeNull();
    expect(verifyCheckInToken(token, { nowMs: nowMs + 1000 })).not.toBeNull();
  });

  it("rejects a token with the wrong purpose", () => {
    const token = makeToken({ purpose: "reschedule", appointmentId: "appt-1", exp: Math.floor(Date.now() / 1000) + 60, nonce: "n" });
    expect(verifyCheckInToken(token)).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(verifyCheckInToken("garbage")).toBeNull();
    expect(verifyCheckInToken("")).toBeNull();
  });
});
