export class LinePushBlockedError extends Error {
  constructor(message = "The user has blocked or unfriended the bot") {
    super(message);
    this.name = "LinePushBlockedError";
  }
}

/**
 * Push a text message via LINE Messaging API. Throws LinePushBlockedError when
 * LINE signals the recipient has blocked or unfriended the Official Account
 * (HTTP 400 "Failed to send messages" or 404 "Not found"), so the caller can
 * stop retrying and surface the blocked state to staff.
 */
export async function pushLineText(lineUserId: string, text: string, retryKey?: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(retryKey ? { "X-Line-Retry-Key": retryKey } : {}) },
    body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text }], notificationDisabled: false }),
    signal: AbortSignal.timeout(8000)
  });
  if (response.status === 409 && response.headers.get("x-line-accepted-request-id")) return;
  if (!response.ok) {
    let message = "";
    try {
      message = ((await response.json()) as { message?: string }).message ?? "";
    } catch {
      // Ignore non-JSON error bodies.
    }
    const blockedSignal =
      (response.status === 400 && /failed to send messages/i.test(message)) ||
      (response.status === 404 && /not found/i.test(message));
    if (blockedSignal) {
      throw new LinePushBlockedError(message || undefined);
    }
    throw new Error(`LINE push failed with status ${response.status}${message ? `: ${message}` : ""}`);
  }
}

/**
 * Proactive friend check: `GET /v2/bot/profile/{userId}` returns 404 when the
 * user has blocked or unfriended the Official Account. Useful to detect a
 * blocked recipient before sending (and avoid an ambiguous push error).
 */
export async function isLineBlocked(lineUserId: string): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return false;
  const response = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(lineUserId)}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  return response.status === 404;
}
