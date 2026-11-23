import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/jobs/mark-missed/route";

const keys = ["CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

describe("mark-missed job", () => {
  it("rejects requests when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(new Request("http://localhost/api/jobs/mark-missed", { headers: { authorization: "Bearer anything" } }));
    expect(response.status).toBe(401);
  });

  it("rejects requests with the wrong bearer token", async () => {
    process.env.CRON_SECRET = "correct-secret";
    const response = await GET(new Request("http://localhost/api/jobs/mark-missed", { headers: { authorization: "Bearer wrong" } }));
    expect(response.status).toBe(401);
  });

  it("returns 503 when Supabase admin is not configured", async () => {
    process.env.CRON_SECRET = "correct-secret";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await GET(new Request("http://localhost/api/jobs/mark-missed", { headers: { authorization: "Bearer correct-secret" } }));
    expect(response.status).toBe(503);
  });
});
