import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasSupabaseAdmin: vi.fn(),
  createAdminClient: vi.fn(),
  pushLineText: vi.fn()
}));

vi.mock("@/lib/supabase/admin", () => ({ hasSupabaseAdmin: mocks.hasSupabaseAdmin, createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/line", async () => {
  const actual = await vi.importActual<typeof import("@/lib/line")>("@/lib/line");
  return { ...actual, pushLineText: mocks.pushLineText };
});

import { GET } from "@/app/api/jobs/notifications/route";
import { LinePushBlockedError } from "@/lib/line";

function chainable<T>(resolveTo: () => T) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "update", "lte", "limit", "single"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (onFulfilled: (value: T) => unknown, onRejected: (error: unknown) => unknown) =>
    Promise.resolve().then(resolveTo).then(onFulfilled, onRejected);
  return builder;
}

function queueSupabase(results: Array<() => unknown>) {
  let index = 0;
  return { from: vi.fn(() => chainable(() => results[Math.min(index++, results.length - 1)]())) };
}

function authorizedRequest() {
  return new Request("http://localhost/api/jobs/notifications", { headers: { authorization: "Bearer secret" } });
}

const candidate = { id: "n1", follow_up_id: "f1", recipient_profile_id: "v1", kind: "follow_up_assigned", attempt_count: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "secret";
});

describe("GET /api/jobs/notifications", () => {
  it("rejects callers without the cron secret", async () => {
    const response = await GET(new Request("http://localhost/api/jobs/notifications", { headers: { authorization: "Bearer wrong" } }));
    expect(response.status).toBe(401);
  });

  it("reports unavailable when Supabase is not configured", async () => {
    mocks.hasSupabaseAdmin.mockReturnValue(false);
    const response = await GET(authorizedRequest());
    expect(response.status).toBe(503);
  });

  it("sends pending assignments via the active volunteer LINE link and marks them sent", async () => {
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    mocks.pushLineText.mockResolvedValue(undefined);
    mocks.createAdminClient.mockReturnValue(queueSupabase([
      () => ({ data: [candidate], error: null }),
      () => ({ data: [{ profile_id: "v1", line_account_id: "la1" }], error: null }),
      () => ({ data: [{ id: "la1", line_user_id: "U123" }], error: null }),
      () => ({ data: { id: "n1" }, error: null }),
      () => ({ data: null, error: null })
    ]));

    const response = await GET(authorizedRequest());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ processed: 1, sent: 1, failed: 0, unlinked: 0 });
    expect(mocks.pushLineText).toHaveBeenCalledTimes(1);
  });

  it("marks unlinked recipients without calling LINE", async () => {
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    mocks.pushLineText.mockResolvedValue(undefined);
    mocks.createAdminClient.mockReturnValue(queueSupabase([
      () => ({ data: [candidate], error: null }),
      () => ({ data: [], error: null }),
      () => ({ data: { id: "n1" }, error: null }),
      () => ({ data: null, error: null })
    ]));

    const response = await GET(authorizedRequest());
    const body = await response.json();
    expect(body).toMatchObject({ processed: 1, sent: 0, failed: 0, unlinked: 1 });
    expect(mocks.pushLineText).not.toHaveBeenCalled();
  });

  it("records a failure without rolling back the assignment", async () => {
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    mocks.pushLineText.mockRejectedValue(new Error("LINE down"));
    mocks.createAdminClient.mockReturnValue(queueSupabase([
      () => ({ data: [candidate], error: null }),
      () => ({ data: [{ profile_id: "v1", line_account_id: "la1" }], error: null }),
      () => ({ data: [{ id: "la1", line_user_id: "U123" }], error: null }),
      () => ({ data: { id: "n1" }, error: null }),
      () => ({ data: null, error: null })
    ]));

    const response = await GET(authorizedRequest());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ processed: 1, sent: 0, failed: 1, unlinked: 0 });
  });

  it("sends the SLA reminder text for reminder notifications", async () => {
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    mocks.pushLineText.mockResolvedValue(undefined);
    mocks.createAdminClient.mockReturnValue(queueSupabase([
      () => ({ data: [{ ...candidate, kind: "follow_up_sla_reminder" }], error: null }),
      () => ({ data: [{ profile_id: "v1", line_account_id: "la1" }], error: null }),
      () => ({ data: [{ id: "la1", line_user_id: "U123" }], error: null }),
      () => ({ data: { id: "n1" }, error: null }),
      () => ({ data: null, error: null })
    ]));

    const response = await GET(authorizedRequest());
    expect(response.status).toBe(200);
    expect(mocks.pushLineText).toHaveBeenCalledTimes(1);
    const sentText = mocks.pushLineText.mock.calls[0][1];
    expect(sentText).toContain("ยังไม่มีผล");
    expect(sentText).not.toMatch(/HN|ชื่อ-นามสกุล|เบาหวาน|ความดัน|ยารักษา|คลินิก/);
  });

  it("marks a blocked recipient as blocked without retrying", async () => {
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    mocks.pushLineText.mockRejectedValue(new LinePushBlockedError("The user has blocked or unfriended the bot"));
    mocks.createAdminClient.mockReturnValue(queueSupabase([
      () => ({ data: [candidate], error: null }),
      () => ({ data: [{ profile_id: "v1", line_account_id: "la1" }], error: null }),
      () => ({ data: [{ id: "la1", line_user_id: "U123" }], error: null }),
      () => ({ data: { id: "n1" }, error: null }),
      () => ({ data: null, error: null })
    ]));

    const response = await GET(authorizedRequest());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ processed: 1, sent: 0, blocked: 1 });
  });
});
