import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireVolunteer: vi.fn(),
  hasSupabaseAdmin: vi.fn(),
  createAdminClient: vi.fn()
}));

vi.mock("@/lib/line/volunteer-auth", () => ({
  requireVolunteer: mocks.requireVolunteer,
  volunteerAuthStatus: (reason: string) =>
    ({ unauthorized: 401, context_required: 403, context_revoked: 403, not_volunteer: 403, inactive: 403, database_required: 503 })[reason] ?? 401
}));
vi.mock("@/lib/supabase/admin", () => ({ hasSupabaseAdmin: mocks.hasSupabaseAdmin, createAdminClient: mocks.createAdminClient }));

import { GET as getMe } from "@/app/api/volunteer/me/route";
import { GET as getTasks } from "@/app/api/volunteer/tasks/route";
import { GET as getTask } from "@/app/api/volunteer/tasks/[id]/route";
import { POST as postResult } from "@/app/api/volunteer/tasks/[id]/result/route";
import { POST as postEscalate } from "@/app/api/volunteer/tasks/[id]/escalate/route";

const volunteerId = "22222222-2222-4222-8222-222222222222";
const taskId = "11111111-1111-4111-8111-111111111111";

const identity = { profileId: volunteerId, fullName: "อสม. มาลี", serviceUnitId: "unit-1" };

type Result = { data: unknown; error: unknown };

function builder(resolveTo: () => Result) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "not", "lte", "maybeSingle", "single"]) {
    b[method] = vi.fn(() => b);
  }
  b.then = (onFulfilled: (value: Result) => unknown, onRejected?: (error: unknown) => unknown) =>
    Promise.resolve().then(resolveTo).then(onFulfilled, onRejected);
  return b;
}

function queueSupabase(results: Array<() => Result>) {
  let index = 0;
  return { from: vi.fn(() => builder(() => results[Math.min(index++, results.length - 1)]())) };
}

const taskRow = {
  id: taskId,
  status: "assigned",
  priority: "normal",
  assigned_at: "2026-11-22T00:00:00.000Z",
  contacted_at: null,
  missed_reason: "ลืมวันนัด",
  version: 1,
  appointments: { appointment_at: "2026-11-21T08:00:00+07:00", clinic: "คลินิกความดัน", patients: { full_name: "นายทดสอบ", village: "สระโคล่", phone: "0811111111" } }
};

function request(url: string, init?: RequestInit) {
  return new Request(url, init);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasSupabaseAdmin.mockReturnValue(true);
});

describe("GET /api/volunteer/me", () => {
  it("returns the volunteer identity", async () => {
    mocks.requireVolunteer.mockResolvedValue({ ok: true, identity });
    const response = await getMe();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, volunteer: { id: volunteerId, fullName: "อสม. มาลี" } });
  });

  it("rejects an unauthenticated request", async () => {
    mocks.requireVolunteer.mockResolvedValue({ ok: false, reason: "unauthorized" });
    const response = await getMe();
    expect(response.status).toBe(401);
  });

  it("rejects a revoked volunteer context", async () => {
    mocks.requireVolunteer.mockResolvedValue({ ok: false, reason: "context_revoked" });
    const response = await getMe();
    expect(response.status).toBe(403);
  });
});

describe("GET /api/volunteer/tasks", () => {
  it("lists tasks scoped to the volunteer and computes SLA", async () => {
    mocks.requireVolunteer.mockResolvedValue({ ok: true, identity });
    const db = queueSupabase([
      () => ({ data: { sla_hours: 48 }, error: null }),
      () => ({ data: [taskRow], error: null })
    ]);
    mocks.createAdminClient.mockReturnValue(db);

    const response = await getTasks(request("http://localhost/api/volunteer/tasks?filter=all"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0].patient.fullName).toBe("นายทดสอบ");
    expect(body.tasks[0]).not.toHaveProperty("hn");
    const taskQuery = db.from.mock.results[1].value;
    expect(taskQuery.select).toHaveBeenCalledWith(expect.stringContaining("appointments!follow_ups_appointment_id_fkey(appointment_at, clinic, patients("));
  });

  it("rejects an invalid filter", async () => {
    mocks.requireVolunteer.mockResolvedValue({ ok: true, identity });
    const response = await getTasks(request("http://localhost/api/volunteer/tasks?filter=bogus"));
    expect(response.status).toBe(422);
  });

  it("rejects an unauthenticated request", async () => {
    mocks.requireVolunteer.mockResolvedValue({ ok: false, reason: "unauthorized" });
    const response = await getTasks(request("http://localhost/api/volunteer/tasks"));
    expect(response.status).toBe(401);
  });
});

describe("GET /api/volunteer/tasks/[id]", () => {
  const params = Promise.resolve({ id: taskId });

  it("returns a task assigned to the volunteer", async () => {
    mocks.requireVolunteer.mockResolvedValue({ ok: true, identity });
    const db = queueSupabase([
      () => ({ data: { sla_hours: 48 }, error: null }),
      () => ({ data: taskRow, error: null })
    ]);
    mocks.createAdminClient.mockReturnValue(db);

    const response = await getTask(request("http://localhost/api/volunteer/tasks/x"), { params });
    expect(response.status).toBe(200);
    const task = (await response.json()).task;
    expect(task.version).toBe(1);
    expect(task.patient.fullName).toBe("นายทดสอบ");
    expect(db.from.mock.results[1].value.select).toHaveBeenCalledWith(expect.stringContaining("appointments!follow_ups_appointment_id_fkey(appointment_at, clinic, patients("));
  });

  it("returns 404 when the task is not the volunteer's (IDOR)", async () => {
    mocks.requireVolunteer.mockResolvedValue({ ok: true, identity });
    mocks.createAdminClient.mockReturnValue(queueSupabase([
      () => ({ data: { sla_hours: 48 }, error: null }),
      () => ({ data: null, error: null })
    ]));

    const response = await getTask(request("http://localhost/api/volunteer/tasks/x"), { params });
    expect(response.status).toBe(404);
  });

  it("rejects an unauthenticated request", async () => {
    mocks.requireVolunteer.mockResolvedValue({ ok: false, reason: "unauthorized" });
    const response = await getTask(request("http://localhost/api/volunteer/tasks/x"), { params });
    expect(response.status).toBe(401);
  });
});

describe("POST /api/volunteer/tasks/[id]/result", () => {
  const params = Promise.resolve({ id: taskId });

  it("records a valid result via the RPC", async () => {
    mocks.requireVolunteer.mockResolvedValue({ ok: true, identity });
    const rpc = vi.fn().mockResolvedValue({ data: { version: 2, status: "contacted", priority: "normal" }, error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await postResult(
      request("http://localhost/api/volunteer/tasks/x/result", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resultCode: "contacted_will_come", note: "มาแน่", channel: "phone", expectedVersion: 1 }) }),
      { params }
    );
    expect(response.status).toBe(200);
    expect((await response.json()).version).toBe(2);
    expect(rpc).toHaveBeenCalledWith("record_volunteer_result", expect.objectContaining({ p_result_code: "contacted_will_come", p_actor_id: volunteerId }));
  });

  it("rejects an unknown result code", async () => {
    mocks.requireVolunteer.mockResolvedValue({ ok: true, identity });
    const response = await postResult(
      request("http://localhost/api/volunteer/tasks/x/result", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resultCode: "nope", channel: "phone", expectedVersion: 1 }) }),
      { params }
    );
    expect(response.status).toBe(422);
  });

  it("requires a version", async () => {
    mocks.requireVolunteer.mockResolvedValue({ ok: true, identity });
    const response = await postResult(
      request("http://localhost/api/volunteer/tasks/x/result", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resultCode: "contacted_will_come", channel: "phone" }) }),
      { params }
    );
    expect(response.status).toBe(422);
  });

  it("maps a version conflict to 409", async () => {
    mocks.requireVolunteer.mockResolvedValue({ ok: true, identity });
    mocks.createAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "P0004", message: "version_conflict" } }) });
    const response = await postResult(
      request("http://localhost/api/volunteer/tasks/x/result", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resultCode: "contacted_will_come", channel: "phone", expectedVersion: 1 }) }),
      { params }
    );
    expect(response.status).toBe(409);
  });

  it("maps a non-assigned volunteer to 403", async () => {
    mocks.requireVolunteer.mockResolvedValue({ ok: true, identity });
    mocks.createAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "42501", message: "follow_up_not_assigned" } }) });
    const response = await postResult(
      request("http://localhost/api/volunteer/tasks/x/result", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resultCode: "contacted_will_come", channel: "phone", expectedVersion: 1 }) }),
      { params }
    );
    expect(response.status).toBe(403);
  });
});

describe("POST /api/volunteer/tasks/[id]/escalate", () => {
  const params = Promise.resolve({ id: taskId });

  it("escalates via the RPC", async () => {
    mocks.requireVolunteer.mockResolvedValue({ ok: true, identity });
    const rpc = vi.fn().mockResolvedValue({ data: { version: 2, priority: "urgent" }, error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await postEscalate(
      request("http://localhost/api/volunteer/tasks/x/escalate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ note: "มีอาการ", expectedVersion: 1 }) }),
      { params }
    );
    expect(response.status).toBe(200);
    expect((await response.json()).priority).toBe("urgent");
  });

  it("rejects an unauthenticated request", async () => {
    mocks.requireVolunteer.mockResolvedValue({ ok: false, reason: "unauthorized" });
    const response = await postEscalate(
      request("http://localhost/api/volunteer/tasks/x/escalate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: 1 }) }),
      { params }
    );
    expect(response.status).toBe(401);
  });
});
