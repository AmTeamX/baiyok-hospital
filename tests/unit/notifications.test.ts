import { describe, expect, it, vi } from "vitest";
import {
  assignmentDeepLink,
  buildAssignmentMessage,
  buildSlaReminderMessage,
  deliverNotification,
  isUnlinkedRecipient,
  MAX_NOTIFICATION_ATTEMPTS,
  nextAttemptAt,
  notificationBackoffSeconds
} from "@/lib/notifications";
import { LinePushBlockedError } from "@/lib/line";

describe("notification helpers", () => {
  it("grows backoff exponentially and caps it", () => {
    expect(notificationBackoffSeconds(1)).toBe(5);
    expect(notificationBackoffSeconds(2)).toBe(10);
    expect(notificationBackoffSeconds(3)).toBe(20);
    expect(notificationBackoffSeconds(20)).toBe(3600);
  });

  it("computes the next attempt timestamp from the backoff", () => {
    const now = new Date("2026-11-23T00:00:00.000Z");
    const at = new Date(nextAttemptAt(2, now));
    expect(at.getTime() - now.getTime()).toBe(10000);
  });

  it("builds a clean deep link", () => {
    vi.stubEnv("NEXT_PUBLIC_LIFF_ID", "123-app");
    expect(assignmentDeepLink("abc-123", "https://app.example/")).toBe("https://liff.line.me/123-app?destination=volunteer%2Ftasks%2Fabc-123");
    vi.unstubAllEnvs();
  });

  it("keeps the push message free of protected health information", () => {
    const message = buildAssignmentMessage("abc-123", "https://app.example");
    expect(message).toContain("abc-123");
    expect(message).not.toMatch(/HN|ชื่อ-นามสกุล|เบาหวาน|ความดัน|ยารักษา|คลินิก/);
  });

  it("keeps the SLA reminder message free of protected health information", () => {
    const message = buildSlaReminderMessage("abc-123", "https://app.example");
    expect(message).toContain("abc-123");
    expect(message).not.toMatch(/HN|ชื่อ-นามสกุล|เบาหวาน|ความดัน|ยารักษา|คลินิก/);
  });

  it("detects unlinked recipients", () => {
    expect(isUnlinkedRecipient(null)).toBe(true);
    expect(isUnlinkedRecipient("   ")).toBe(true);
    expect(isUnlinkedRecipient("U123")).toBe(false);
  });
});

describe("deliverNotification", () => {
  const base = { id: "n1", followUpId: "f1", kind: "follow_up_assigned", lineUserId: "U123" };

  it("sends once on success", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const result = await deliverNotification({ ...base, attemptCountAfterClaim: 1 }, send);
    expect(result).toEqual({ status: "sent" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1]).not.toMatch(/HN|ชื่อ-นามสกุล|เบาหวาน|ความดัน|ยารักษา|คลินิก/);
  });

  it("sends the SLA reminder text for reminder notifications", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await deliverNotification({ ...base, kind: "follow_up_sla_reminder", attemptCountAfterClaim: 1 }, send);
    expect(send.mock.calls[0][1]).toContain("ยังไม่มีผล");
  });

  it("returns unlinked without sending when there is no LINE id", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const result = await deliverNotification({ ...base, lineUserId: null, attemptCountAfterClaim: 1 }, send);
    expect(result).toEqual({ status: "unlinked" });
    expect(send).not.toHaveBeenCalled();
  });

  it("schedules a retry when below the attempt ceiling", async () => {
    const send = vi.fn().mockRejectedValue(new Error("LINE down"));
    const result = await deliverNotification({ ...base, attemptCountAfterClaim: 2 }, send);
    expect(result).toMatchObject({ status: "failed", errorMessage: "LINE down" });
    expect((result as { nextAttemptAt: string }).nextAttemptAt).toBeTruthy();
  });

  it("dead-letters after exhausting attempts", async () => {
    const send = vi.fn().mockRejectedValue(new Error("LINE down"));
    const result = await deliverNotification({ ...base, attemptCountAfterClaim: MAX_NOTIFICATION_ATTEMPTS }, send);
    expect(result).toEqual({ status: "dead_letter", errorMessage: "LINE down" });
  });

  it("marks a blocked recipient as terminal without retrying", async () => {
    const send = vi.fn().mockRejectedValue(new LinePushBlockedError("The user has blocked or unfriended the bot"));
    const result = await deliverNotification({ ...base, attemptCountAfterClaim: 1 }, send);
    expect(result).toEqual({ status: "blocked", errorMessage: "The user has blocked or unfriended the bot" });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
