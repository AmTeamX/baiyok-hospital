import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasSupabaseAdmin: vi.fn(),
  createAdminClient: vi.fn(),
  dispatchNotifications: vi.fn()
}));

vi.mock("@/lib/supabase/admin", () => ({ hasSupabaseAdmin: mocks.hasSupabaseAdmin, createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/notification-dispatch", () => ({ dispatchNotifications: mocks.dispatchNotifications }));

import { GET } from "@/app/api/jobs/escalations/route";

function authorizedRequest() {
  return new Request("http://localhost/api/jobs/escalations", { headers: { authorization: "Bearer secret" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "secret";
  mocks.dispatchNotifications.mockResolvedValue({ processed: 3, sent: 3, failed: 0, unlinked: 0, blocked: 0 });
});

describe("GET /api/jobs/escalations", () => {
  it("rejects callers without the cron secret", async () => {
    const response = await GET(new Request("http://localhost/api/jobs/escalations", { headers: { authorization: "Bearer wrong" } }));
    expect(response.status).toBe(401);
  });

  it("reports unavailable when Supabase is not configured", async () => {
    mocks.hasSupabaseAdmin.mockReturnValue(false);
    const response = await GET(authorizedRequest());
    expect(response.status).toBe(503);
  });

  it("enqueues SLA reminders via the RPC and reports the count", async () => {
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    const rpc = vi.fn().mockResolvedValue({ data: { enqueued: 3, at: "2026-11-24T00:00:00Z" }, error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await GET(authorizedRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ enqueued: 3 });
    expect(rpc).toHaveBeenCalledWith("enqueue_sla_reminders");
    expect(mocks.dispatchNotifications).toHaveBeenCalledTimes(1);
  });

  it("surfaces an RPC error as a 500", async () => {
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    mocks.createAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }) });

    const response = await GET(authorizedRequest());
    expect(response.status).toBe(500);
  });
});
