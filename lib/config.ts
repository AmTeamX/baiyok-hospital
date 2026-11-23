const requiredKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CHECKIN_SIGNING_SECRET",
  "CRON_SECRET"
] as const;

const optionalKeys = [
  "NEXT_PUBLIC_LINE_OA_BASIC_ID",
  "NEXT_PUBLIC_LIFF_ID",
  "LINE_CHANNEL_SECRET",
  "LINE_CHANNEL_ACCESS_TOKEN",
  "LIFF_SESSION_SECRET",
  "LINE_RICH_MENU_DEFAULT_ID",
  "LINE_RICH_MENU_PATIENT_ID",
  "LINE_RICH_MENU_VOLUNTEER_ID",
  "LINE_RICH_MENU_MULTIROLE_ID"
] as const;

const publicKeys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_LINE_OA_BASIC_ID", "NEXT_PUBLIC_LIFF_ID"] as const;
const serverKeys = [
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

type ConfigKey = (typeof requiredKeys)[number] | (typeof optionalKeys)[number];

function present(key: ConfigKey) {
  return Boolean(process.env[key]?.trim());
}

export function getRuntimeConfig() {
  const hasSupabase = present("NEXT_PUBLIC_SUPABASE_URL") && present("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const missingRequired = requiredKeys.filter((key) => !present(key));
  const missingOptional = optionalKeys.filter((key) => !present(key));
  return {
    mode: hasSupabase ? "database" as const : "demo" as const,
    hasSupabase,
    requiredKeys,
    optionalKeys,
    missingRequired,
    missingOptional,
    missingPublic: publicKeys.filter((key) => !present(key)),
    missingServer: serverKeys.filter((key) => !present(key)),
    readyForProduction: missingRequired.length === 0
  };
}

export function assertServerConfig(keys: readonly ConfigKey[]) {
  const missing = keys.filter((key) => !present(key));
  if (missing.length) throw new Error(`Missing runtime configuration: ${missing.join(", ")}`);
}
