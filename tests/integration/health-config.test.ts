import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/config/route";

describe("health/config route", () => {
  it("returns configuration status without secret values", async () => {
    const response = GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
    expect(body).not.toHaveProperty("LINE_CHANNEL_ACCESS_TOKEN");
    expect(body).toHaveProperty("requiredKeys");
    expect(body).toHaveProperty("optionalKeys");
  });
});
