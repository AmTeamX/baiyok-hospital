import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const LIFF_SESSION_COOKIE = "liff_session";
export const LIFF_CONTEXT_COOKIE = "liff_context";
export const LIFF_NONCE_COOKIE = "liff_nonce";

export const LIFF_SESSION_TTL_SECONDS = 60 * 60 * 24; // 24h; context is re-validated on every request.
export const LIFF_NONCE_TTL_SECONDS = 5 * 60; // 5 minutes to complete a LIFF exchange.

export type LiffSession = {
  lineAccountId: string;
  lineUserId: string;
  exp: number; // unix seconds
};

export type LiffContext = {
  linkId: string;
  lineAccountId: string;
  role: "patient" | "volunteer";
  exp: number; // unix seconds
};

export function getSessionSecret(): string | null {
  return process.env.LIFF_SESSION_SECRET?.trim() || null;
}

export function signPayload(payload: unknown, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyPayload<T>(token: string, secret: string): T | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof payload !== "object" || payload === null) return null;
    if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) return null;
    return payload as T;
  } catch {
    return null;
  }
}

function isSecure(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://"));
}

const httpOnly = { httpOnly: true, sameSite: "lax" as const, path: "/", secure: isSecure() };

export async function setSessionCookie(session: LiffSession) {
  const secret = getSessionSecret();
  if (!secret) return false;
  const store = await cookies();
  store.set(LIFF_SESSION_COOKIE, signPayload(session, secret), { ...httpOnly, maxAge: LIFF_SESSION_TTL_SECONDS });
  return true;
}

export async function readSession(): Promise<LiffSession | null> {
  const secret = getSessionSecret();
  if (!secret) return null;
  const store = await cookies();
  const value = store.get(LIFF_SESSION_COOKIE)?.value;
  if (!value) return null;
  return verifyPayload<LiffSession>(value, secret);
}

export async function setContextCookie(context: LiffContext) {
  const secret = getSessionSecret();
  if (!secret) return false;
  const store = await cookies();
  store.set(LIFF_CONTEXT_COOKIE, signPayload(context, secret), { ...httpOnly, maxAge: LIFF_SESSION_TTL_SECONDS });
  return true;
}

export async function readContext(): Promise<LiffContext | null> {
  const secret = getSessionSecret();
  if (!secret) return null;
  const store = await cookies();
  const value = store.get(LIFF_CONTEXT_COOKIE)?.value;
  if (!value) return null;
  return verifyPayload<LiffContext>(value, secret);
}

export async function setNonceCookie(nonce: string) {
  const store = await cookies();
  store.set(LIFF_NONCE_COOKIE, nonce, { ...httpOnly, maxAge: LIFF_NONCE_TTL_SECONDS });
}

export async function consumeNonce(expected: string): Promise<boolean> {
  const store = await cookies();
  const current = store.get(LIFF_NONCE_COOKIE)?.value;
  if (!current) return false;
  const left = Buffer.from(current);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  store.delete(LIFF_NONCE_COOKIE);
  return true;
}

export async function clearLiffSession() {
  const store = await cookies();
  store.delete(LIFF_SESSION_COOKIE);
  store.delete(LIFF_CONTEXT_COOKIE);
  store.delete(LIFF_NONCE_COOKIE);
}
