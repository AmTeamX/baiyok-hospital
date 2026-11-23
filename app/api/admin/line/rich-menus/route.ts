import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireClinicalStaff } from "@/lib/supabase/server";
import { buildRichMenuSpecs, getRichMenuIds, provisionRichMenus, setDefaultRichMenu, uploadRichMenuImage, type RichMenuKind } from "@/lib/line/rich-menu";

export function GET() {
  const ids = getRichMenuIds();
  return NextResponse.json({ ok: true, menus: ids });
}

export async function POST() {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!channelAccessToken || !baseUrl) {
    return NextResponse.json({ ok: false, error: "line_not_configured" }, { status: 503 });
  }

  try {
    const report = await provisionRichMenus(buildRichMenuSpecs(baseUrl), { channelAccessToken });
    const imageResults: Array<{ kind: RichMenuKind; uploaded: boolean }> = [];
    for (const menu of report.menus) {
      const root = path.join(process.cwd(), "public", "rich-menu");
      const jpgPath = path.join(root, `${menu.kind}.jpg`);
      const pngPath = path.join(root, `${menu.kind}.png`);
      let imagePath = jpgPath;
      try { await readFile(imagePath); } catch { imagePath = pngPath; }
      const image = await readFile(imagePath);
      imageResults.push({ kind: menu.kind, uploaded: await uploadRichMenuImage(menu.id, image, { channelAccessToken, contentType: imagePath.endsWith(".jpg") ? "image/jpeg" : "image/png" }) });
    }
    if (report.defaultMenuId) {
      await setDefaultRichMenu(report.defaultMenuId, { channelAccessToken });
    }
    return NextResponse.json({ ok: true, ...report, imageResults });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "provision_failed" },
      { status: 502 }
    );
  }
}
