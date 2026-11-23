const publicKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_LINE_OA_BASIC_ID",
  "NEXT_PUBLIC_LIFF_ID"
] as const;

const serverKeys = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "LINE_CHANNEL_SECRET",
  "LINE_CHANNEL_ACCESS_TOKEN",
  "CHECKIN_SIGNING_SECRET",
  "CRON_SECRET"
] as const;

type ConfigKey = (typeof publicKeys)[number] | (typeof serverKeys)[number];

function present(key: ConfigKey) {
  return Boolean(process.env[key]?.trim());
}

export function getRuntimeConfig() {
  const hasSupabase = present("NEXT_PUBLIC_SUPABASE_URL") && present("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const missingPublic = publicKeys.filter((key) => !present(key));
  const missingServer = serverKeys.filter((key) => !present(key));
  return {
    mode: hasSupabase ? "database" as const : "demo" as const,
    hasSupabase,
    missingPublic,
    missingServer,
    readyForProduction: missingPublic.length === 0 && missingServer.length === 0
  };
}

export function assertServerConfig(keys: readonly ConfigKey[]) {
  const missing = keys.filter((key) => !present(key));
  if (missing.length) throw new Error(`Missing runtime configuration: ${missing.join(", ")}`);
}
