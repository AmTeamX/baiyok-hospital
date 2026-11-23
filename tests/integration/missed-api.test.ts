import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/missed/route";

const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

describe("missed registry API (demo mode)", () => {
  it("returns filtered demo rows when Supabase is not configured", async () => {
    for (const key of keys) delete process.env[key];
    const response = await GET(new Request("http://localhost/api/missed?status=assigned"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.mode).toBe("demo");
    expect(body.total).toBe(1);
    expect(Array.isArray(body.rows)).toBe(true);
    expect(body.rows.every((row: { status: string }) => row.status === "assigned")).toBe(true);
    expect(Array.isArray(body.volunteers)).toBe(true);
    expect(Array.isArray(body.areas)).toBe(true);
  });

  it("filters demo rows by unassigned flag", async () => {
    for (const key of keys) delete process.env[key];
    const response = await GET(new Request("http://localhost/api/missed?unassigned=1"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.rows[0].unassigned).toBe(true);
  });
});
