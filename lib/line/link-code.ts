import { createHash, randomBytes } from "node:crypto";

export const LINK_CODE_TTL_MS = 15 * 60 * 1000;

export type LinkCodeRole = "patient" | "volunteer";
export type LinkCodeTargetType = "patient" | "profile";

export function generateLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function linkCodeExpiresAt(nowMs: number = Date.now()): string {
  return new Date(nowMs + LINK_CODE_TTL_MS).toISOString();
}

export function isLinkCodeExpired(expiresAt: string, nowMs: number = Date.now()): boolean {
  return new Date(expiresAt).getTime() <= nowMs;
}
