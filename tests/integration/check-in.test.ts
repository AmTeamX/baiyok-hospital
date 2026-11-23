import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyCheckInToken: vi.fn(),
  hasSupabaseAdmin: vi.fn(),
  createAdminClient: vi.fn()
}));

vi.mock("@/lib/check-in-token", () => ({ verifyCheckInToken: mocks.verifyCheckInToken }));
vi.mock("@/lib/supabase/admin", () => ({ hasSupabaseAdmin: mocks.hasSupabaseAdmin, createAdminClient: mocks.createAdminClient }));

import { POST } from "@/app/api/check-in/route";

function request(body: unknown) {
  return new Request("http://localhost/api/check-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasSupabaseAdmin.mockReturnValue(true);
});

describe("POST /api/check-in", () => {
  it("rejects an incomplete request", async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(422);
  });

  it("rejects an invalid or expired token", async () => {
    mocks.verifyCheckInToken.mockReturnValue(null);
    const response = await POST(request({ appointmentId: "a1", token: "bad" }));
    expect(response.status).toBe(401);
  });

  it("rejects a token that does not match the appointment", async () => {
    mocks.verifyCheckInToken.mockReturnValue({ appointmentId: "other", nonce: "n" });
    const response = await POST(request({ appointmentId: "a1", token: "valid" }));
    expect(response.status).toBe(401);
  });

  it("checks in via the RPC and reports idempotency", async () => {
    mocks.verifyCheckInToken.mockReturnValue({ appointmentId: "a1", nonce: "nonce-1" });
    const rpc = vi.fn().mockResolvedValue({ data: { appointment_id: "a1", already: false }, error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await POST(request({ appointmentId: "a1", token: "valid" }));
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("check_in_appointment", expect.objectContaining({ p_appointment_id: "a1", p_nonce: "nonce-1" }));
  });

  it("maps a cancelled appointment to 409", async () => {
    mocks.verifyCheckInToken.mockReturnValue({ appointmentId: "a1", nonce: "n" });
    mocks.createAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "P0006", message: "appointment_cancelled" } }) });

    const response = await POST(request({ appointmentId: "a1", token: "valid" }));
    expect(response.status).toBe(409);
  });
});
