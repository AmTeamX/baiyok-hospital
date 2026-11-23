import { beforeEach, describe, expect, it, vi } from "vitest";
import { LinePushBlockedError, isLineBlocked, pushLineText } from "@/lib/line";

beforeEach(() => {
  process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token";
});

describe("pushLineText", () => {
  it("pushes a message and returns when LINE accepts it", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    globalThis.fetch = fetchImpl as unknown as typeof fetch;

    await expect(pushLineText("U123", "hello")).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.line.me/v2/bot/message/push",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws LinePushBlockedError on 400 Failed to send messages", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Failed to send messages" }), { status: 400 }));
    globalThis.fetch = fetchImpl as unknown as typeof fetch;

    await expect(pushLineText("U123", "hello")).rejects.toBeInstanceOf(LinePushBlockedError);
  });

  it("throws LinePushBlockedError on 404 Not found", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Not found" }), { status: 404 }));
    globalThis.fetch = fetchImpl as unknown as typeof fetch;

    await expect(pushLineText("U123", "hello")).rejects.toBeInstanceOf(LinePushBlockedError);
  });

  it("throws a generic error for other failures (e.g. 500)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Internal error" }), { status: 500 }));
    globalThis.fetch = fetchImpl as unknown as typeof fetch;

    await expect(pushLineText("U123", "hello")).rejects.toThrow(/LINE push failed with status 500/);
  });
});

describe("isLineBlocked", () => {
  it("reports blocked when the profile endpoint returns 404", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Not found" }), { status: 404 }));
    globalThis.fetch = fetchImpl as unknown as typeof fetch;

    await expect(isLineBlocked("U123")).resolves.toBe(true);
  });

  it("reports not blocked when the profile endpoint returns 200", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ userId: "U123", displayName: "x" }), { status: 200 }));
    globalThis.fetch = fetchImpl as unknown as typeof fetch;

    await expect(isLineBlocked("U123")).resolves.toBe(false);
  });
});
