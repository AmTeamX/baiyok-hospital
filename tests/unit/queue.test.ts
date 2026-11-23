import { describe, expect, it } from "vitest";
import {
  isValidQueueBookingStatus,
  QUEUE_BOOKING_STATUSES,
  QUEUE_BOOKING_STATUS_LABELS
} from "@/lib/queue";

describe("queue booking status", () => {
  it("accepts every defined status", () => {
    for (const status of QUEUE_BOOKING_STATUSES) expect(isValidQueueBookingStatus(status)).toBe(true);
  });

  it("rejects unknown statuses", () => {
    expect(isValidQueueBookingStatus("attended")).toBe(false);
    expect(isValidQueueBookingStatus(42)).toBe(false);
  });

  it("has a label for every status", () => {
    for (const status of QUEUE_BOOKING_STATUSES) expect(QUEUE_BOOKING_STATUS_LABELS[status]).toBeTruthy();
  });
});
