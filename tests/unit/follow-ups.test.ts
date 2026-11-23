import { describe, expect, it } from "vitest";
import { isValidMissedReason, isValidNursingActivity, isValidPriority, normalizePriority } from "@/lib/follow-ups";

describe("follow-up validation", () => {
  it("accepts only known missed reasons", () => {
    expect(isValidMissedReason("ลืมวันนัด")).toBe(true);
    expect(isValidMissedReason("")).toBe(false);
    expect(isValidMissedReason("ไม่ทราบ")).toBe(false);
  });

  it("accepts only known nursing activities", () => {
    expect(isValidNursingActivity("โทรศัพท์ติดตาม")).toBe(true);
    expect(isValidNursingActivity("")).toBe(false);
    expect(isValidNursingActivity("drop table")).toBe(false);
  });

  it("validates and normalizes priority", () => {
    expect(isValidPriority("urgent")).toBe(true);
    expect(isValidPriority("bogus")).toBe(false);
    expect(normalizePriority("urgent")).toBe("urgent");
    expect(normalizePriority("bogus")).toBe("normal");
    expect(normalizePriority(undefined)).toBe("normal");
    expect(normalizePriority(123)).toBe("normal");
  });
});
