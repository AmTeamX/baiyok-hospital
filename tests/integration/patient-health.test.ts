import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePatient: vi.fn(),
  supabase: { from: vi.fn() }
}));

vi.mock("@/lib/line/patient-auth", () => ({
  requirePatient: mocks.requirePatient,
  patientAuthStatus: (reason: string) =>
    ({ unauthorized: 401, context_required: 403, context_revoked: 403, patient_not_found: 403, database_required: 503 })[reason] ?? 401
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => mocks.supabase) }));

import { GET as getContent } from "@/app/api/patient/me/health-content/route";
import { POST as postAnswer } from "@/app/api/patient/me/health-answers/route";

type Result = { data: unknown; error: unknown };

function builder(resolveTo: () => Result) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "upsert"]) {
    b[method] = vi.fn(() => b);
  }
  b.then = (onFulfilled: (value: Result) => unknown) => Promise.resolve().then(resolveTo).then(onFulfilled);
  return b;
}

function queueFrom(results: Array<() => Result>) {
  let index = 0;
  return { from: vi.fn(() => builder(() => results[Math.min(index++, results.length - 1)]())) };
}

const identity = { patientId: "pat-1", fullName: "นายทดสอบ" };

function request(body: unknown) {
  return new Request("http://localhost/api/patient/me/health-answers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/patient/me/health-content", () => {
  it("rejects an unauthenticated request", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: false, reason: "unauthorized" });
    expect((await getContent()).status).toBe(401);
  });

  it("returns published content with its questions", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: true, identity });
    mocks.supabase.from.mockImplementation(queueFrom([
      () => ({ data: [{ id: "c1", slug: "no-symptoms", title: "ไม่มีอาการ ไม่ได้แปลว่าหาย", body: "…", image_url: null, image_alt: null, version: 1 }], error: null }),
      () => ({ data: [{ id: "q1", content_id: "c1", prompt: "คำถาม?", options: [{ value: "a", label: "ถูก", correct: true, feedback: "ดี" }], sort_order: 1 }], error: null })
    ]).from);

    const response = await getContent();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.contents[0].questions).toHaveLength(1);
    expect(body.contents[0].questions[0].prompt).toBe("คำถาม?");
  });
});

describe("POST /api/patient/me/health-answers", () => {
  it("records an answer via upsert", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: true, identity });
    mocks.supabase.from.mockReturnValue(builder(() => ({ data: null, error: null })));

    const response = await postAnswer(request({ questionId: "11111111-1111-4111-8111-111111111111", selectedValue: "a", contentVersion: 1 }));
    expect(response.status).toBe(200);
    expect(mocks.supabase.from).toHaveBeenCalledWith("health_answers");
  });

  it("rejects an invalid question id", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: true, identity });
    const response = await postAnswer(request({ questionId: "not-a-uuid", selectedValue: "a" }));
    expect(response.status).toBe(422);
  });

  it("rejects an empty answer", async () => {
    mocks.requirePatient.mockResolvedValue({ ok: true, identity });
    const response = await postAnswer(request({ questionId: "11111111-1111-4111-8111-111111111111", selectedValue: "" }));
    expect(response.status).toBe(422);
  });
});
