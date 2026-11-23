import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireClinicalStaff } from "@/lib/supabase/server";
import { buildRichMenuSpecs, getRichMenuIds, linkRichMenuToUser, provisionRichMenus, selectRichMenuKind, setDefaultRichMenu, uploadRichMenuImage, type RichMenuKind } from "@/lib/line/rich-menu";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";

export function GET() {
  const ids = getRichMenuIds();
  return NextResponse.json({ ok: true, menus: ids });
}

export async function POST() {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!channelAccessToken || !baseUrl || !process.env.NEXT_PUBLIC_LIFF_ID?.trim()) {
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
    if (imageResults.some((item) => !item.uploaded)) throw new Error("อัปโหลดภาพเมนู LINE ไม่สำเร็จ กรุณาลองใหม่");
    if (report.defaultMenuId && !await setDefaultRichMenu(report.defaultMenuId, { channelAccessToken })) throw new Error("ตั้งค่าเมนูเริ่มต้นไม่สำเร็จ");
    const sync = { linked: 0, failed: 0 };
    if (hasSupabaseAdmin()) {
      const supabase = createAdminClient();
      for (let offset = 0; ; offset += 100) {
        const { data: accounts, error } = await supabase.from("line_accounts").select("id, line_user_id").order("id").range(offset, offset + 99);
        if (error) throw error;
        if (!accounts?.length) break;
        const { data: links, error: linkError } = await supabase.from("line_account_links").select("line_account_id, role").in("line_account_id", accounts.map((item) => item.id)).eq("status", "active");
        if (linkError) throw linkError;
        for (const account of accounts) {
          const roles = (links ?? []).filter((item) => item.line_account_id === account.id).map((item) => item.role as "patient" | "volunteer");
          const menuId = report.menus.find((item) => item.kind === selectRichMenuKind(roles))!.id;
          if (await linkRichMenuToUser(account.line_user_id, menuId, { channelAccessToken })) {
            sync.linked += 1;
            await supabase.from("line_accounts").update({ rich_menu_id: menuId, rich_menu_linked_at: new Date().toISOString() }).eq("id", account.id);
          } else sync.failed += 1;
        }
        if (accounts.length < 100) break;
      }
    }
    return NextResponse.json({ ok: true, ...report, imageResults, sync });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "provision_failed" },
      { status: 502 }
    );
  }
}
