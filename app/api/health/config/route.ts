import { NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/config";

export function GET() {
  const config = getRuntimeConfig();
  return NextResponse.json({
    ok: config.mode === "database" || config.mode === "demo",
    mode: config.mode,
    readyForProduction: config.readyForProduction,
    requiredKeys: config.requiredKeys,
    optionalKeys: config.optionalKeys,
    missingRequired: config.missingRequired,
    missingOptional: config.missingOptional
  });
}
