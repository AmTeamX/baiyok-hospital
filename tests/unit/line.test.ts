import { beforeEach, describe, expect, it, vi } from "vitest";
import { LinePushBlockedError, isLineBlocked, pushLineText } from "@/lib/line";

beforeEach(() => {
  process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token";
});

describe("pushLineText", () => {
  it("requests a visible notification and uses the outbox ID as a retry key", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    globalThis.fetch = fetchImpl;
    await pushLineText("U123", "new case", "11111111-1111-4111-8111-111111111111");
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ "X-Line-Retry-Key": "11111111-1111-4111-8111-111111111111" });
    expect(JSON.parse(String(init.body)).notificationDisabled).toBe(false);
  });
  it("treats an already accepted retry as success without another message", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 409, headers: { "x-line-accepted-request-id": "accepted-1" } }));
    await expect(pushLineText("U123", "new case", "11111111-1111-4111-8111-111111111111")).resolves.toBeUndefined();
  });
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
