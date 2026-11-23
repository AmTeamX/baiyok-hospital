import { createHash, randomBytes } from "node:crypto";

export const LINK_CODE_TTL_MS = 15 * 60 * 1000;

export type LinkCodeRole = "patient" | "volunteer";
export type LinkCodeTargetType = "patient" | "profile";

// Short, human-typeable code (no ambiguous 0/O/1/I). The QR can't reliably carry
// query params through LINE's LIFF deep link, so the code is meant to be typed in.
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const LINK_CODE_LENGTH = 6;

export function generateLinkToken(): string {
  const bytes = randomBytes(LINK_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < LINK_CODE_LENGTH; i += 1) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

export function normalizeLinkCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
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
