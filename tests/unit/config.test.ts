import { afterEach, describe, expect, it } from "vitest";
import { getRuntimeConfig } from "@/lib/config";

const keys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_LINE_OA_BASIC_ID",
  "NEXT_PUBLIC_LIFF_ID",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LINE_CHANNEL_SECRET",
  "LINE_CHANNEL_ACCESS_TOKEN",
  "CHECKIN_SIGNING_SECRET",
  "CRON_SECRET",
  "LIFF_SESSION_SECRET",
  "LINE_RICH_MENU_DEFAULT_ID",
  "LINE_RICH_MENU_PATIENT_ID",
  "LINE_RICH_MENU_VOLUNTEER_ID",
  "LINE_RICH_MENU_MULTIROLE_ID"
] as const;

const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

describe("runtime configuration", () => {
  it("uses demo mode when Supabase is not configured", () => {
    for (const key of keys) delete process.env[key];
    const config = getRuntimeConfig();
    expect(config.mode).toBe("demo");
    expect(config.readyForProduction).toBe(false);
    expect(config.missingRequired).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("does not report missing keys when production config is complete", () => {
    for (const key of keys) process.env[key] = "test-value";
    const config = getRuntimeConfig();
    expect(config.mode).toBe("database");
    expect(config.readyForProduction).toBe(true);
    expect(config.missingRequired).toEqual([]);
  });
});
