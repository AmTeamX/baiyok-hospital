import { describe, expect, it, vi } from "vitest";
import { buildRichMenuSpecs, provisionRichMenus, selectRichMenuKind, richMenuVersionName } from "@/lib/line/rich-menu";

vi.stubEnv("NEXT_PUBLIC_LIFF_ID", "123-app");

describe("selectRichMenuKind", () => {
  it("maps a single patient role", () => {
    expect(selectRichMenuKind(["patient"])).toBe("patient");
  });
  it("maps a single volunteer role", () => {
    expect(selectRichMenuKind(["volunteer"])).toBe("volunteer");
  });
  it("maps a multi-role account", () => {
    expect(selectRichMenuKind(["patient", "volunteer"])).toBe("multi");
  });
  it("maps an unlinked account to default", () => {
    expect(selectRichMenuKind([])).toBe("default");
  });
});

describe("buildRichMenuSpecs", () => {
  it("builds one spec per role with stable names and 4 areas", () => {
    const specs = buildRichMenuSpecs("https://app.example");
    expect(specs.map((spec) => spec.name)).toEqual(["srkolo-default", "srkolo-patient", "srkolo-volunteer", "srkolo-multi"]);
    for (const spec of specs) {
      if (spec.kind !== "default") expect(spec.areas).toHaveLength(4);
      for (const area of spec.areas) expect(area.action).toMatchObject({ type: "uri", uri: expect.stringMatching(/^https:\/\/liff.line.me\/123-app\?/) });
    }
  });
});

describe("provisionRichMenus", () => {
  it("changes the version when the LIFF destination changes", () => {
    const spec = buildRichMenuSpecs("https://app.example")[1];
    const updated = { ...spec, areas: spec.areas.map((area, index) => index === 0 ? { ...area, action: { type: "uri" as const, uri: "https://liff.line.me/123-app?destination=context" } } : area) };
    expect(richMenuVersionName(updated)).not.toBe(richMenuVersionName(spec));
  });
  function existingList(menus: Array<{ richMenuId: string; name?: string }>) {
    return { richmenus: menus };
  }

  it("reuses existing menus and never creates duplicates on re-run", async () => {
    const specs = buildRichMenuSpecs("https://app.example");
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const path = String(url).replace("https://api.line.me/v2/bot", "");
      if (path === "/richmenu/list") {
        return new Response(JSON.stringify(existingList(specs.map((spec) => ({ richMenuId: `existing-${spec.kind}`, name: richMenuVersionName(spec) })))), { status: 200 });
      }
      throw new Error(`unexpected call: ${path}`);
    });

    const report = await provisionRichMenus(specs, { channelAccessToken: "token", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(report.menus.every((menu) => menu.reused && !menu.created)).toBe(true);
    expect(report.defaultMenuId).toBe("existing-default");
    // No create calls were made.
    expect(fetchImpl.mock.calls.filter(([url]) => String(url).endsWith("/richmenu")).length).toBe(0);
  });

  it("creates menus once when none exist", async () => {
    const specs = buildRichMenuSpecs("https://app.example");
    const created = new Map<string, string>();
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url).replace("https://api.line.me/v2/bot", "");
      if (path === "/richmenu/list") {
        return new Response(JSON.stringify({ richmenus: [] }), { status: 200 });
      }
      if (path === "/richmenu" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { name: string };
        const id = `created-${body.name}`;
        created.set(body.name, id);
        return new Response(JSON.stringify({ richMenuId: id }), { status: 200 });
      }
      throw new Error(`unexpected call: ${path}`);
    });

    const report = await provisionRichMenus(specs, { channelAccessToken: "token", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(report.menus.every((menu) => menu.created && !menu.reused)).toBe(true);
    expect(created.size).toBe(specs.length);
  });
});
