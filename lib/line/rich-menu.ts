export type RichMenuKind = "default" | "patient" | "volunteer" | "multi";

export type RichMenuAction =
  | { type: "uri"; uri: string }
  | { type: "postback"; data: string };

export type RichMenuArea = {
  bounds: { x: number; y: number; width: number; height: number };
  action: RichMenuAction;
};

export type RichMenuSpec = {
  kind: RichMenuKind;
  name: string;
  chatBarText: string;
  areas: RichMenuArea[];
};

export type RichMenuDeps = {
  channelAccessToken: string;
  fetchImpl?: typeof fetch;
  contentType?: "image/png" | "image/jpeg";
};

export type ProvisionReport = {
  menus: Array<{ kind: RichMenuKind; id: string; created: boolean; reused: boolean }>;
  defaultMenuId: string | null;
};

const LINE_API = "https://api.line.me/v2/bot";

export function selectRichMenuKind(roles: Array<"patient" | "volunteer">): RichMenuKind {
  const hasPatient = roles.includes("patient");
  const hasVolunteer = roles.includes("volunteer");
  if (hasPatient && hasVolunteer) return "multi";
  if (hasVolunteer) return "volunteer";
  if (hasPatient) return "patient";
  return "default";
}

export function getRichMenuIds(): Record<RichMenuKind, string | null> {
  return {
    default: process.env.LINE_RICH_MENU_DEFAULT_ID?.trim() || null,
    patient: process.env.LINE_RICH_MENU_PATIENT_ID?.trim() || null,
    volunteer: process.env.LINE_RICH_MENU_VOLUNTEER_ID?.trim() || null,
    multi: process.env.LINE_RICH_MENU_MULTIROLE_ID?.trim() || null
  };
}

function liffUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export function buildRichMenuSpecs(baseUrl: string): RichMenuSpec[] {
  const box = { x: 0, y: 0, width: 2500, height: 1686 };
  const areas = (actions: RichMenuAction[]): RichMenuArea[] => {
    const rows = 2;
    const cols = 2;
    return actions.map((action, index) => ({
      bounds: {
        x: Math.round((index % cols) * (box.width / cols)),
        y: Math.round(Math.floor(index / cols) * (box.height / rows)),
        width: Math.round(box.width / cols),
        height: Math.round(box.height / rows)
      },
      action
    }));
  };
  return [
    {
      kind: "default",
      name: "srkolo-default",
      chatBarText: "เปิดเมนู",
      areas: areas([{ type: "uri", uri: liffUrl(baseUrl, "/liff/link") }])
    },
    {
      kind: "patient",
      name: "srkolo-patient",
      chatBarText: "เมนูผู้ป่วย",
      areas: areas([
        { type: "uri", uri: liffUrl(baseUrl, "/liff/appointments") },
        { type: "uri", uri: liffUrl(baseUrl, "/liff/education") },
        { type: "uri", uri: liffUrl(baseUrl, "/liff/problem") },
        { type: "uri", uri: `https://line.me/R/oaMessage/${process.env.NEXT_PUBLIC_LINE_OA_BASIC_ID ?? ""}` }
      ])
    },
    {
      kind: "volunteer",
      name: "srkolo-volunteer",
      chatBarText: "เมนู อสม.",
      areas: areas([
        { type: "uri", uri: liffUrl(baseUrl, "/liff/volunteer") },
        { type: "uri", uri: liffUrl(baseUrl, "/liff/volunteer?filter=urgent") },
        { type: "uri", uri: liffUrl(baseUrl, "/liff/volunteer?filter=pending") },
        { type: "uri", uri: liffUrl(baseUrl, "/liff/volunteer/contact-nurse") }
      ])
    },
    {
      kind: "multi",
      name: "srkolo-multi",
      chatBarText: "เลือกโหมด",
      areas: areas([
        { type: "uri", uri: liffUrl(baseUrl, "/liff/context?role=patient") },
        { type: "uri", uri: liffUrl(baseUrl, "/liff/context?role=volunteer") },
        { type: "uri", uri: liffUrl(baseUrl, "/liff/appointments") },
        { type: "uri", uri: liffUrl(baseUrl, "/liff/volunteer") }
      ])
    }
  ];
}

function authorized(token: string) {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

/**
 * Idempotently provisions rich menus. Menus are identified by a stable `name`,
 * so a re-run reuses existing menus instead of creating duplicates.
 */
export async function provisionRichMenus(
  specs: RichMenuSpec[],
  deps: RichMenuDeps
): Promise<ProvisionReport> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const listResponse = await fetchImpl(`${LINE_API}/richmenu/list`, { headers: authorized(deps.channelAccessToken) });
  if (!listResponse.ok) throw new Error(`LINE list rich menus failed: ${listResponse.status}`);
  const list = (await listResponse.json()) as { richmenus?: Array<{ richMenuId: string; name?: string }> };
  const byName = new Map((list.richmenus ?? []).map((menu) => [menu.name, menu.richMenuId]));

  const report: ProvisionReport = { menus: [], defaultMenuId: null };

  for (const spec of specs) {
    let id = byName.get(spec.name);
    let created = false;
    let reused = false;
    if (id) {
      reused = true;
    } else {
      const createResponse = await fetchImpl(`${LINE_API}/richmenu`, {
        method: "POST",
        headers: authorized(deps.channelAccessToken),
        body: JSON.stringify({
          size: { width: 2500, height: 1686 },
          selected: spec.kind === "default",
          name: spec.name,
          chatBarText: spec.chatBarText,
          areas: spec.areas
        })
      });
      if (!createResponse.ok) throw new Error(`LINE create rich menu failed for ${spec.kind}: ${createResponse.status}`);
      const createdMenu = (await createResponse.json()) as { richMenuId: string };
      id = createdMenu.richMenuId;
      created = true;
    }
    report.menus.push({ kind: spec.kind, id, created, reused });
    if (spec.kind === "default") report.defaultMenuId = id;
  }

  return report;
}

export async function linkRichMenuToUser(
  userId: string,
  richMenuId: string,
  deps: RichMenuDeps
): Promise<boolean> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const response = await fetchImpl(`${LINE_API}/user/${encodeURIComponent(userId)}/richmenu/${encodeURIComponent(richMenuId)}`, {
    method: "POST",
    headers: authorized(deps.channelAccessToken)
  });
  return response.ok;
}

export async function setDefaultRichMenu(richMenuId: string, deps: RichMenuDeps): Promise<boolean> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const response = await fetchImpl(`${LINE_API}/user/all/richmenu/${encodeURIComponent(richMenuId)}`, {
    method: "POST",
    headers: authorized(deps.channelAccessToken)
  });
  return response.ok;
}

export async function uploadRichMenuImage(richMenuId: string, image: Uint8Array, deps: RichMenuDeps): Promise<boolean> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const response = await fetchImpl(`${LINE_API}/richmenu/${encodeURIComponent(richMenuId)}/content`, {
    method: "POST",
    headers: { authorization: `Bearer ${deps.channelAccessToken}`, "content-type": deps.contentType ?? "image/png" },
    body: image as BodyInit
  });
  return response.ok;
}

export async function unlinkRichMenuFromUser(userId: string, deps: RichMenuDeps): Promise<boolean> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const response = await fetchImpl(`${LINE_API}/user/${encodeURIComponent(userId)}/richmenu`, {
    method: "DELETE",
    headers: authorized(deps.channelAccessToken)
  });
  return response.ok;
}
