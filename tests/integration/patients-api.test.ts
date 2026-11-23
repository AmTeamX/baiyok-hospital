import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireClinicalStaff: vi.fn(),
  hasSupabaseAdmin: vi.fn(),
  supabase: { from: vi.fn() }
}));

vi.mock("@/lib/supabase/server", () => ({ requireClinicalStaff: mocks.requireClinicalStaff }));
vi.mock("@/lib/supabase/admin", () => ({ hasSupabaseAdmin: mocks.hasSupabaseAdmin, createAdminClient: vi.fn(() => mocks.supabase) }));

import { GET as listPatients } from "@/app/api/patients/route";
import { GET as getPatient, PATCH as patchPatient } from "@/app/api/patients/[id]/route";
import { POST as addAppointment } from "@/app/api/patients/[id]/appointments/route";

const actorId = "33333333-3333-4333-8333-333333333333";
const patientId = "11111111-1111-4111-8111-111111111111";

type Result = { data: unknown; error: unknown; count?: number };

function builder(resolveTo: () => Result) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "or", "in", "order", "range", "single", "update", "insert"]) {
    b[method] = vi.fn(() => b);
  }
  b.then = (onFulfilled: (value: Result) => unknown) => Promise.resolve().then(resolveTo).then(onFulfilled);
  return b;
}

function queueFrom(results: Array<() => Result>) {
  let index = 0;
  return { from: vi.fn(() => builder(() => results[Math.min(index++, results.length - 1)]())) };
}

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new Request(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasSupabaseAdmin.mockReturnValue(true);
});

describe("GET /api/patients", () => {
  it("rejects an unauthenticated caller", async () => {
    mocks.requireClinicalStaff.mockResolvedValue(null);
    expect((await listPatients(new Request("http://localhost/api/patients"))).status).toBe(401);
  });

  it("lists patients with their latest appointment summary", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.supabase.from.mockImplementation(queueFrom([
      () => ({ data: [{ id: patientId, hn: "00123", full_name: "นายทดสอบ", phone: null, village: "สระโคล่", birth_date: null }], count: 1, error: null }),
      () => ({ data: [{ id: "a1", patient_id: patientId, appointment_at: "2026-12-01T08:00:00+07:00", clinic: "คลินิกความดัน", status: "scheduled" }], error: null })
    ]).from);

    const response = await listPatients(new Request("http://localhost/api/patients?page=1"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.patients[0]).toMatchObject({ fullName: "นายทดสอบ", appointmentCount: 1 });
    expect(body.patients[0].latestAppointment.clinic).toBe("คลินิกความดัน");
  });
});

describe("GET /api/patients/[id]", () => {
  it("returns the patient with appointments and line status", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.supabase.from.mockImplementation(queueFrom([
      () => ({ data: { id: patientId, hn: "00123", full_name: "นายทดสอบ", phone: null, village: "สระโคล่", birth_date: null, contact_preference: "line" }, error: null }),
      () => ({ data: [{ id: "a1", appointment_at: "2026-12-01T08:00:00+07:00", clinic: "คลินิกความดัน", status: "scheduled", attended_at: null, missed_marked_at: null }], error: null }),
      () => ({ data: [{ id: "f1", appointment_id: "a1", status: "pending", priority: "normal", missed_reason: null }], error: null }),
      () => ({ data: [{ id: "l1", status: "active", line_account_id: "la1", line_accounts: { line_user_id: "U123", display_name: "นายทดสอบ" } }], error: null })
    ]).from);

    const response = await getPatient(new Request("http://localhost/api/patients/x"), { params: Promise.resolve({ id: patientId }) });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.patient.hn).toBe("00123");
    expect(body.line.linked).toBe(true);
    expect(body.appointments[0].followUp.status).toBe("pending");
  });
});

describe("PATCH /api/patients/[id]", () => {
  it("updates patient info", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.supabase.from.mockImplementation(queueFrom([
      () => ({ data: { id: patientId }, error: null }),
      () => ({ data: null, error: null })
    ]).from);

    const response = await patchPatient(jsonRequest("http://localhost/api/patients/x", { fullName: "ชื่อใหม่" }, "PATCH"), { params: Promise.resolve({ id: patientId }) });
    expect(response.status).toBe(200);
  });
});

describe("POST /api/patients/[id]/appointments", () => {
  it("adds an appointment to the patient", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.supabase.from.mockImplementation(queueFrom([
      () => ({ data: { id: patientId }, error: null }),
      () => ({ data: { id: "a1" }, error: null })
    ]).from);

    const response = await addAppointment(jsonRequest("http://localhost/api/patients/x/appointments", { appointmentDate: "2026-12-01", appointmentTime: "08:30", clinic: "คลินิกความดัน" }), { params: Promise.resolve({ id: patientId }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, appointmentId: "a1" });
  });

  it("automatically marks a past appointment as missed", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.supabase.from.mockImplementation(queueFrom([
      () => ({ data: { id: patientId }, error: null }),
      () => ({ data: { id: "a-past" }, error: null }),
      () => ({ data: null, error: null })
    ]).from);

    const response = await addAppointment(jsonRequest(
      "http://localhost/api/patients/x/appointments",
      { appointmentDate: "2020-01-01", appointmentTime: "08:30", clinic: "คลินิกความดัน", status: "scheduled" },
      "POST"
    ), { params: Promise.resolve({ id: patientId }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, appointmentId: "a-past", status: "missed" });
  });

  it("reports a duplicate appointment as 409", async () => {
    mocks.requireClinicalStaff.mockResolvedValue({ mode: "authenticated", userId: actorId, serviceUnitId: "unit-1" });
    mocks.supabase.from.mockImplementation(queueFrom([
      () => ({ data: { id: patientId }, error: null }),
      () => ({ data: null, error: { code: "23505", message: "duplicate" } })
    ]).from);

    const response = await addAppointment(jsonRequest("http://localhost/api/patients/x/appointments", { appointmentDate: "2026-12-01", clinic: "คลินิกความดัน" }), { params: Promise.resolve({ id: patientId }) });
    expect(response.status).toBe(409);
  });
});
