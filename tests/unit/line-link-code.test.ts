import { describe, expect, it } from "vitest";
import { generateLinkToken, hashLinkToken, isLinkCodeExpired, linkCodeExpiresAt, LINK_CODE_TTL_MS } from "@/lib/line/link-code";

describe("line link code", () => {
  it("hashes a token deterministically with sha256", () => {
    const token = "abc123";
    expect(hashLinkToken(token)).toBe(hashLinkToken(token));
    expect(hashLinkToken(token)).toHaveLength(64);
  });

  it("generates unique, non-empty tokens", () => {
    const a = generateLinkToken();
    const b = generateLinkToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
    expect(hashLinkToken(a)).not.toBe(hashLinkToken(b));
  });

  it("expires 15 minutes from creation", () => {
    const now = new Date("2026-01-01T00:00:00Z").getTime();
    expect(new Date(linkCodeExpiresAt(now)).getTime() - now).toBe(LINK_CODE_TTL_MS);
    expect(isLinkCodeExpired(linkCodeExpiresAt(now), now)).toBe(false);
    expect(isLinkCodeExpired(linkCodeExpiresAt(now), now + LINK_CODE_TTL_MS)).toBe(true);
  });
});
