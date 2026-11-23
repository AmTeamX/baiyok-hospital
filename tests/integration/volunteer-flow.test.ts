import { describe, expect, it, vi } from "vitest";
import {
  assignmentDeepLink,
  buildAssignmentMessage,
  deliverNotification
} from "@/lib/notifications";

describe("volunteer assignment → push → LIFF loop (mock provider)", () => {
  it("deep links to the volunteer task page with a PHI-free push message", async () => {
    const link = assignmentDeepLink("fu-1", "https://app.example");
    expect(link).toBe("https://app.example/liff/link?destination=volunteer%2Ftasks%2Ffu-1");

    const message = buildAssignmentMessage("fu-1", "https://app.example");
    expect(message).toContain(link);
    expect(message).not.toMatch(/HN|ชื่อ-นามสกุล|เบาหวาน|ความดัน|ยารักษา|คลินิก/);
  });

  it("delivers an SLA reminder pointing at the same protected task page", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const result = await deliverNotification(
      { id: "n1", followUpId: "fu-1", kind: "follow_up_sla_reminder", lineUserId: "U123", attemptCountAfterClaim: 1 },
      send,
      "https://app.example"
    );
    expect(result).toEqual({ status: "sent" });
    expect(send.mock.calls[0][1]).toContain("destination=volunteer%2Ftasks%2Ffu-1");
    expect(send.mock.calls[0][1]).not.toMatch(/HN|ชื่อ-นามสกุล|เบาหวาน|ความดัน|ยารักษา|คลินิก/);
  });

  it("does not push to a volunteer without a linked LINE account", async () => {
    const send = vi.fn();
    const result = await deliverNotification(
      { id: "n1", followUpId: "fu-1", kind: "follow_up_assigned", lineUserId: null, attemptCountAfterClaim: 1 },
      send,
      "https://app.example"
    );
    expect(result).toEqual({ status: "unlinked" });
    expect(send).not.toHaveBeenCalled();
  });
});
