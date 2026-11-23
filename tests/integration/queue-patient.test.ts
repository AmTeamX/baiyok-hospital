import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePatient: vi.fn(),
  supabase: { from: vi.fn(), rpc: vi.fn() }
}));

vi.mock("@/lib/line/patient-auth", () => ({
  requirePatient: mocks.requirePatient,
  patientAuthStatus: (reason: string) =>
    ({ unauthorized: 401, context_required: 403, context_revoked: 403, patient_not_found: 403, database_required: 503 })[reason] ?? 401
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => mocks.supabase) }));

import { GET as getSlots } from "@/app/api/patient/me/queue-slots/route";
import { GET as getBookings, POST as postBooking } from "@/app/api/patient/me/bookings/route";
import { POST as cancelBooking } from "@/app/api/patient/me/bookings/[id]/cancel/route";

type Result = { data: unknown; error: unknown };

function builder(resolveTo: () => Result) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "order", "limit"]) {
    b[method] = vi.fn(() => b);
  }
  b.then = (onFulfilled: (value: Result) => unknown) => Promise.resolve().then(resolveTo).then(onFulfilled);
  return b;
}

const identity = { patientId: "pat-1", fullName: "นายทดสอบ" };
const slotId = "11111111-1111-4111-8111-111111111111";
const bookingId = "22222222-2222-4222-8222-222222222222";

function jsonRequest(url: string, body: unknown) {
  return new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CHECKIN_SIGNING_SECRET = "test-secret";
});

describe("GET /api/patient/me/queue-slots", () => {
  it("rejects an unauthenticated request", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: false, reason: "unauthorized" });
    expect((await getSlots()).status).toBe(401);
  });

  it("returns only slots that still have capacity", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: true, identity });
    mocks.supabase.from.mockReturnValue(builder(() => ({
      data: [
        { id: "s1", clinic: "คลินิกความดัน", service_date: "2026-12-01", starts_at: "2026-12-01T08:00:00+07:00", ends_at: "2026-12-01T09:00:00+07:00", capacity: 20, booked_count: 5, active: true },
        { id: "s2", clinic: "คลินิกความดัน", service_date: "2026-12-01", starts_at: "2026-12-01T09:00:00+07:00", ends_at: "2026-12-01T10:00:00+07:00", capacity: 2, booked_count: 2, active: true }
      ],
      error: null
    })));

    const response = await getSlots();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.slots).toHaveLength(1);
    expect(body.slots[0]).toMatchObject({ id: "s1", remaining: 15 });
  });
});

describe("POST /api/patient/me/bookings", () => {
  it("books a slot and returns a check-in URL", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: true, identity });
    mocks.supabase.rpc.mockResolvedValue({
      data: { booking_id: bookingId, appointment_id: "a1", queue_number: 6, slot_id: slotId },
      error: null
    });

    const response = await postBooking(jsonRequest("http://localhost/api/patient/me/bookings", { slotId }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, queueNumber: 6, bookingId });
    expect(body.checkInUrl).toContain("/check-in?appointment=a1&token=");
    expect(mocks.supabase.rpc).toHaveBeenCalledWith("book_slot", { p_slot_id: slotId, p_patient_id: "pat-1" });
  });

  it("maps a full or duplicate slot to 409", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: true, identity });
    mocks.supabase.rpc.mockResolvedValue({ data: null, error: { code: "P0007", message: "slot_full" } });
    const response = await postBooking(jsonRequest("http://localhost/api/patient/me/bookings", { slotId }));
    expect(response.status).toBe(409);
  });

  it("rejects an invalid slot id", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: true, identity });
    const response = await postBooking(jsonRequest("http://localhost/api/patient/me/bookings", { slotId: "nope" }));
    expect(response.status).toBe(422);
  });
});

describe("POST /api/patient/me/bookings/[id]/cancel", () => {
  it("cancels the patient's own booking", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: true, identity });
    mocks.supabase.rpc.mockResolvedValue({ data: { booking_id: bookingId, status: "cancelled" }, error: null });

    const response = await cancelBooking(jsonRequest("http://localhost/api/patient/me/bookings/x/cancel", {}), { params: Promise.resolve({ id: bookingId }) });
    expect(response.status).toBe(200);
    expect(mocks.supabase.rpc).toHaveBeenCalledWith("cancel_booking", { p_booking_id: bookingId, p_patient_id: "pat-1" });
  });

  it("maps a missing booking to 404", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: true, identity });
    mocks.supabase.rpc.mockResolvedValue({ data: null, error: { code: "P0002", message: "booking_not_found" } });
    const response = await cancelBooking(jsonRequest("http://localhost/api/patient/me/bookings/x/cancel", {}), { params: Promise.resolve({ id: bookingId }) });
    expect(response.status).toBe(404);
  });
});

describe("GET /api/patient/me/bookings", () => {
  it("rejects an unauthenticated request", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: false, reason: "unauthorized" });
    expect((await getBookings()).status).toBe(401);
  });
});
