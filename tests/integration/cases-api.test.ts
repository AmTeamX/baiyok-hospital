import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ staff: vi.fn(), admin: vi.fn(), enabled: vi.fn(), dispatch: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ requireClinicalStaff: mocks.staff }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin, hasSupabaseAdmin: mocks.enabled }));
vi.mock("@/lib/notification-dispatch", () => ({ dispatchNotifications: mocks.dispatch }));
import { GET, POST } from "@/app/api/cases/route";
import { GET as appointmentGET } from "@/app/api/cases/appointment/route";
const id = "90ee94dd-a13b-40c8-a46e-cce1743d594c";
const staff = { userId: "11111111-1111-4111-8111-111111111111", serviceUnitId: "unit-1", role: "nurse", mode: "authenticated" };
function request(body: unknown) { return new Request("http://localhost/api/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.clearAllMocks(); mocks.staff.mockResolvedValue(staff); mocks.enabled.mockReturnValue(true); });
describe("case management API", () => {
  it("requires staff authentication for reads and writes", async () => {
    mocks.staff.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/cases"))).status).toBe(401);
    expect((await POST(request({}))).status).toBe(401);
    expect((await appointmentGET(new Request("http://localhost/api/cases/appointment"))).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("does not fabricate successful creation in demo mode", async () => {
    mocks.enabled.mockReturnValue(false);
    expect((await POST(request({ appointmentId: id, priority: "normal" }))).status).toBe(503);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it("validates appointment and priority before calling the database", async () => {
    expect((await POST(request({ appointmentId: "wrong", priority: "normal" }))).status).toBe(422);
    expect((await POST(request({ appointmentId: id, priority: "unknown" }))).status).toBe(422);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("creates atomically with the current actor and dispatches the new assignment", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "case-1", appointment_id: id, existing: false }, error: null });
    mocks.admin.mockReturnValue({ rpc }); mocks.dispatch.mockResolvedValue({ sent: 1 });
    const response = await POST(request({ appointmentId: id, priority: "urgent", note: " โทรติดตาม ", actorId: "forged" }));
    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("create_case", { p_appointment_id: id, p_priority: "urgent", p_volunteer_id: null, p_note: "โทรติดตาม", p_actor_id: staff.userId });
    expect(mocks.dispatch).toHaveBeenCalledWith({ appointmentId: id });
  });
  it("returns an existing case without sending the new-case notification again", async () => {
    mocks.admin.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: { id: "case-existing", appointment_id: id, existing: true }, error: null }) });
    const response = await POST(request({ appointmentId: id, priority: "normal" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "case-existing", existing: true });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it("preserves a created case if immediate LINE delivery is unavailable", async () => {
    mocks.admin.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: { id: "case-1", appointment_id: id, existing: false }, error: null }) });
    mocks.dispatch.mockRejectedValue(new Error("unavailable"));
    expect((await POST(request({ appointmentId: id, priority: "normal" }))).status).toBe(201);
  });
  it.each([["42501", 403], ["P0002", 404], ["P0003", 422], ["unexpected", 500]])("maps database error %s to %i", async (code, status) => {
    mocks.admin.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code } }) });
    expect((await POST(request({ appointmentId: id, priority: "normal" }))).status).toBe(status);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it("limits the registry and appointment resolver to the staff unit", async () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ["select", "eq", "order", "range", "is", "or"]) chain[method] = vi.fn(() => chain);
    chain.then = vi.fn((resolve) => Promise.resolve({ data: [], count: 0, error: null }).then(resolve));
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    mocks.admin.mockReturnValue({ from: vi.fn(() => chain) });
    expect((await GET(new Request("http://localhost/api/cases?assignee=unassigned"))).status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith("appointment.patient.service_unit_id", staff.serviceUnitId);
    expect(chain.is).toHaveBeenCalledWith("assigned_volunteer_id", null);
    expect((await appointmentGET(new Request(`http://localhost/api/cases/appointment?appointmentId=${id}`))).status).toBe(404);
    expect(chain.eq).toHaveBeenCalledWith("patients.service_unit_id", staff.serviceUnitId);
  });
});
