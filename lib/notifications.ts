import { LinePushBlockedError } from "@/lib/line";

export const MAX_NOTIFICATION_ATTEMPTS = 5;

const BACKOFF_BASE_SECONDS = 5;
const BACKOFF_CAP_SECONDS = 3600;

/** Exponential backoff for a notification that failed `attemptCount` times (1-based). */
export function notificationBackoffSeconds(attemptCount: number): number {
  const attempts = Math.max(1, Math.floor(attemptCount));
  return Math.min(BACKOFF_BASE_SECONDS * 2 ** (attempts - 1), BACKOFF_CAP_SECONDS);
}

export function nextAttemptAt(attemptCount: number, now = new Date()): string {
  return new Date(now.getTime() + notificationBackoffSeconds(attemptCount) * 1000).toISOString();
}

/** Deep link to the volunteer LIFF task. The target re-checks assignment authorization. */
export function assignmentDeepLink(followUpId: string, appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""): string {
  return `${appUrl.replace(/\/+$/, "")}/liff/volunteer/tasks/${followUpId}`;
}

/**
 * Push message for a new assignment. Intentionally contains no HN, full name,
 * diagnosis, medication or clinic detail — only a task notice and a deep link.
 */
export function buildAssignmentMessage(followUpId: string, appUrl?: string): string {
  return `มีงานติดตามผู้ป่วยใหม่ 1 ราย\nกรุณาเปิดลิงก์เพื่อดูรายละเอียดและบันทึกผล\n${assignmentDeepLink(followUpId, appUrl)}`;
}

/**
 * Push message reminding a volunteer that an assigned task still has no result.
 * Same privacy rule: no HN, full name, diagnosis, medication or clinic detail.
 */
export function buildSlaReminderMessage(followUpId: string, appUrl?: string): string {
  return `งานติดตามที่ได้รับมอบหมายยังไม่มีผล\nกรุณาเปิดลิงก์เพื่อบันทึกผลการติดตาม\n${assignmentDeepLink(followUpId, appUrl)}`;
}

/** Pick the outbound text for a notification kind without exposing clinical detail. */
export function buildNotificationMessage(kind: string, followUpId: string, appUrl?: string): string {
  return kind === "follow_up_sla_reminder"
    ? buildSlaReminderMessage(followUpId, appUrl)
    : buildAssignmentMessage(followUpId, appUrl);
}

/** A volunteer without a linked LINE user id cannot receive a Push Message. */
export function isUnlinkedRecipient(lineUserId?: string | null): boolean {
  return !lineUserId?.trim();
}

export type DeliveryResult =
  | { status: "sent" }
  | { status: "blocked"; errorMessage: string }
  | { status: "failed"; errorMessage: string; nextAttemptAt: string }
  | { status: "dead_letter"; errorMessage: string }
  | { status: "unlinked" };

/**
 * Deliver one notification attempt. `attemptCountAfterClaim` is the attempt number
 * for this delivery (1-based). The caller records the returned state in the outbox.
 */
export async function deliverNotification(
  notification: { id: string; followUpId: string | null; kind: string; lineUserId: string | null; attemptCountAfterClaim: number },
  send: (lineUserId: string, message: string) => Promise<void>,
  appUrl?: string
): Promise<DeliveryResult> {
  if (isUnlinkedRecipient(notification.lineUserId)) return { status: "unlinked" };
  const message = buildNotificationMessage(notification.kind, notification.followUpId ?? notification.id, appUrl);
  try {
    await send(notification.lineUserId as string, message);
    return { status: "sent" };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "unknown error";
    if (error instanceof LinePushBlockedError) {
      return { status: "blocked", errorMessage: messageText };
    }
    if (notification.attemptCountAfterClaim >= MAX_NOTIFICATION_ATTEMPTS) {
      return { status: "dead_letter", errorMessage: messageText };
    }
    return { status: "failed", errorMessage: messageText, nextAttemptAt: nextAttemptAt(notification.attemptCountAfterClaim) };
  }
}
