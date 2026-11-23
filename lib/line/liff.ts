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
  | "invalid_nonce"
  | "missing_sub"
  | "malformed";

export type LiffValidationResult =
  | { ok: true; lineUserId: string; claims: LiffIdTokenClaims }
  | { ok: false; reason: LiffVerifyError };

export type LiffValidationOptions = {
  clientId: string;
  nonce?: string;
  nowMs?: number;
};

/**
 * Server-side validation of a LIFF ID token's claims. The cryptographic signature is
 * verified by LINE when we call the `/verify` endpoint (see `verifyLiffIdToken`);
 * this function enforces the non-cryptographic claims that LINE's response must satisfy.
 */
export function validateLiffClaims(
  claims: Partial<LiffIdTokenClaims> | null,
  options: LiffValidationOptions
): LiffValidationResult {
  const nowMs = options.nowMs ?? Date.now();
  if (!claims) return { ok: false, reason: "malformed" };
  if (claims.iss !== LINE_ISSUER) return { ok: false, reason: "invalid_issuer" };
  if (claims.aud !== options.clientId) return { ok: false, reason: "invalid_audience" };
  if (typeof claims.exp !== "number" || claims.exp <= nowMs / 1000) return { ok: false, reason: "expired" };
  if (typeof claims.sub !== "string" || claims.sub.length === 0) return { ok: false, reason: "missing_sub" };
  if (options.nonce !== undefined && claims.nonce !== options.nonce) return { ok: false, reason: "invalid_nonce" };
  return { ok: true, lineUserId: claims.sub, claims: claims as LiffIdTokenClaims };
}

export async function verifyLiffIdToken(
  idToken: string,
  clientId: string,
  nonce: string | undefined,
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
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!response.ok) return { ok: false, reason: "malformed" };
  const claims = (await response.json()) as Partial<LiffIdTokenClaims> | null;
  return validateLiffClaims(claims, { clientId, nonce });
}
