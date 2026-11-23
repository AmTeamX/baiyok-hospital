import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const CHECKIN_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes

export type CheckInTokenPayload = {
  purpose: "check_in";
  appointmentId: string;
  exp: number; // unix seconds
  nonce: string;
};

export type SignCheckInTokenOptions = {
  ttlSeconds?: number;
  nowMs?: number;
  nonce?: string;
};

function getSecret(): string | null {
  return process.env.CHECKIN_SIGNING_SECRET?.trim() || null;
}

/**
 * Opaque, signed QR token. Carries the appointment id, an expiry and a nonce
 * bound together with a purpose claim, so a token cannot be re-used for another
 * appointment, another purpose, or after it expires. Contains no HN or PHI.
 */
export function signCheckInToken(appointmentId: string, options: SignCheckInTokenOptions = {}): string {
  const secret = getSecret();
  if (!secret) throw new Error("CHECKIN_SIGNING_SECRET is not configured");
  const nowMs = options.nowMs ?? Date.now();
  const payload: CheckInTokenPayload = {
    purpose: "check_in",
    appointmentId,
    exp: Math.floor(nowMs / 1000) + (options.ttlSeconds ?? CHECKIN_TOKEN_TTL_SECONDS),
    nonce: options.nonce ?? randomBytes(16).toString("base64url")
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyCheckInToken(
  token: string,
  options: { nowMs?: number } = {}
): { appointmentId: string; nonce: string } | null {
  const secret = getSecret();
  if (!secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<CheckInTokenPayload>;
    if (!payload || typeof payload !== "object") return null;
    if (payload.purpose !== "check_in") return null;
    if (typeof payload.appointmentId !== "string" || payload.appointmentId.length === 0) return null;
    if (typeof payload.exp !== "number" || payload.exp <= Math.floor((options.nowMs ?? Date.now()) / 1000)) return null;
    return { appointmentId: payload.appointmentId, nonce: typeof payload.nonce === "string" ? payload.nonce : "" };
  } catch {
    return null;
  }
}
