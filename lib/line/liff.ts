const LINE_ISSUER = "https://access.line.me";
export const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

export type LiffIdTokenClaims = {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat?: number;
  nonce?: string;
  name?: string;
  picture?: string;
};

export type LiffVerifyError =
  | "invalid_issuer"
  | "invalid_audience"
  | "expired"
  | "missing_sub"
  | "malformed";

export type LiffValidationResult =
  | { ok: true; lineUserId: string; claims: LiffIdTokenClaims }
  | { ok: false; reason: LiffVerifyError; detail?: string };

export type LiffValidationOptions = {
  clientId: string;
  nowMs?: number;
};

/**
 * Server-side validation of a LIFF ID token's claims. The cryptographic signature is
 * verified by LINE when we call the `/verify` endpoint (see `verifyLiffIdToken`).
 * Replay protection is handled separately via the nonce cookie, not via the ID token
 * (LIFF ID tokens do not carry a nonce that matches our server nonce).
 */
export function validateLiffClaims(
  claims: Partial<LiffIdTokenClaims> | null,
  options: LiffValidationOptions
): LiffValidationResult {
  const nowMs = options.nowMs ?? Date.now();
  if (!claims) return { ok: false, reason: "malformed" };
  if (claims.iss !== LINE_ISSUER) return { ok: false, reason: "invalid_issuer" };
  if (claims.aud !== options.clientId) return { ok: false, reason: "invalid_audience", detail: `aud=${claims.aud} expected=${options.clientId}` };
  if (typeof claims.exp !== "number" || claims.exp <= nowMs / 1000) return { ok: false, reason: "expired" };
  if (typeof claims.sub !== "string" || claims.sub.length === 0) return { ok: false, reason: "missing_sub" };
  return { ok: true, lineUserId: claims.sub, claims: claims as LiffIdTokenClaims };
}

export async function verifyLiffIdToken(
  idToken: string,
  clientId: string,
  fetchImpl: typeof fetch = fetch
): Promise<LiffValidationResult> {
  const body = new URLSearchParams({ id_token: idToken, client_id: clientId });
  let response: Response;
  try {
    response = await fetchImpl(LINE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });
  } catch (error) {
    return { ok: false, reason: "malformed", detail: error instanceof Error ? error.message : "network error" };
  }
  if (!response.ok) {
    let detail = `LINE verify returned ${response.status}`;
    try {
      detail += `: ${await response.text()}`;
    } catch {
      // ignore
    }
    return { ok: false, reason: "malformed", detail };
  }
  const claims = (await response.json()) as Partial<LiffIdTokenClaims> | null;
  return validateLiffClaims(claims, { clientId });
}
