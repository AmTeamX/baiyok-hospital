import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireClinicalStaff: vi.fn(),
  hasSupabaseAdmin: vi.fn(),
  createAdminClient: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({ requireClinicalStaff: mocks.requireClinicalStaff }));
vi.mock("@/lib/supabase/admin", () => ({
  hasSupabaseAdmin: mocks.hasSupabaseAdmin,
  createAdminClient: mocks.createAdminClient
}));

import { PATCH } from "@/app/api/appointments/[id]/route";

const appointmentId = "11111111-1111-4111-8111-111111111111";
const params = Promise.resolve({ id: appointmentId });

function request(body: unknown) {
  return new Request(`http://localhost/api/appointments/${appointmentId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/appointments/[id]", () => {
  it("rejects unauthenticated users", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(null);
    const response = await PATCH(request({ status: "cancelled" }), { params });
    expect(response.status).toBe(401);
  });

  it("requires a date, time, and clinic when rescheduling", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: "u1", serviceUnitId: "unit-1" });
    mocks.hasSupabaseAdmin.mockReturnValue(true);
    const response = await PATCH(request({ status: "scheduled", clinic: "" }), { params });
    expect(response.status).toBe(422);
  });

  it("cancels an appointment belonging to the clinical unit", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: "u1", serviceUnitId: "unit-1" });
    mocks.hasSupabaseAdmin.mockReturnValue(true);

    const appointmentBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: appointmentId, patient_id: "patient-1" }, error: null })
    };
    const patientBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "patient-1" }, error: null })
    };
    const updateBuilder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null })
    };
    const linkBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
    };
    const from = vi.fn()
      .mockReturnValueOnce(appointmentBuilder)
      .mockReturnValueOnce(patientBuilder)
      .mockReturnValueOnce(updateBuilder)
      .mockReturnValueOnce(linkBuilder);
    mocks.createAdminClient.mockReturnValue({ from });

    const response = await PATCH(request({ status: "cancelled" }), { params });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, status: "cancelled" });
    expect(updateBuilder.update).toHaveBeenCalledWith({ status: "cancelled" });
  });

  it("reschedules an appointment with a normalized ISO time", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: "u1", serviceUnitId: "unit-1" });
    mocks.hasSupabaseAdmin.mockReturnValue(true);

    const appointmentBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: appointmentId, patient_id: "patient-1" }, error: null })
    };
    const patientBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "patient-1" }, error: null })
    };
    const updateBuilder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null })
    };
    const linkBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
    };
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn()
        .mockReturnValueOnce(appointmentBuilder)
        .mockReturnValueOnce(patientBuilder)
        .mockReturnValueOnce(updateBuilder)
        .mockReturnValueOnce(linkBuilder)
    });

    const response = await PATCH(request({
      status: "scheduled",
      appointmentAt: "2026-12-01T08:30:00+07:00",
      clinic: "คลินิกสุขภาพ"
    }), { params });
    expect(response.status).toBe(200);
    expect(updateBuilder.update).toHaveBeenCalledWith({
      status: "scheduled",
      appointment_at: "2026-12-01T01:30:00.000Z",
      clinic: "คลินิกสุขภาพ"
    });
  });
});
