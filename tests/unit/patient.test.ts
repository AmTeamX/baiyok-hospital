import { describe, expect, it } from "vitest";
import {
  feedbackForAnswer,
  isValidPatientRequestReason,
  isValidPatientRequestStatus,
  isValidPatientRequestType,
  PATIENT_REQUEST_REASONS,
  PATIENT_REQUEST_REASON_LABELS,
  PATIENT_REQUEST_STATUSES,
  PATIENT_REQUEST_STATUS_LABELS,
  PATIENT_REQUEST_TYPES,
  PATIENT_REQUEST_TYPE_LABELS
} from "@/lib/patient";

describe("patient request validation", () => {
  it("accepts the two request types and rejects others", () => {
    expect(isValidPatientRequestType("problem")).toBe(true);
    expect(isValidPatientRequestType("consult")).toBe(true);
    expect(isValidPatientRequestType("reschedule")).toBe(false);
  });

  it("validates reasons against the request type", () => {
    expect(isValidPatientRequestReason("problem", "travel_difficulty")).toBe(true);
    expect(isValidPatientRequestReason("consult", "medication")).toBe(true);
    expect(isValidPatientRequestReason("problem", "medication")).toBe(false);
    expect(isValidPatientRequestReason("consult", "travel_difficulty")).toBe(false);
  });

  it("accepts every defined status and rejects unknown ones", () => {
    for (const status of PATIENT_REQUEST_STATUSES) expect(isValidPatientRequestStatus(status)).toBe(true);
    expect(isValidPatientRequestStatus("done")).toBe(false);
  });

  it("has a label for every reason, type and status", () => {
    for (const type of PATIENT_REQUEST_TYPES) {
      expect(PATIENT_REQUEST_TYPE_LABELS[type]).toBeTruthy();
      for (const reason of PATIENT_REQUEST_REASONS[type]) expect(PATIENT_REQUEST_REASON_LABELS[reason]).toBeTruthy();
    }
    for (const status of PATIENT_REQUEST_STATUSES) expect(PATIENT_REQUEST_STATUS_LABELS[status]).toBeTruthy();
  });
});

describe("health question feedback", () => {
  const question = {
    id: "q1",
    prompt: "คำถาม?",
    options: [
      { value: "a", label: "ถูก", correct: true, feedback: "ดีมาก" },
      { value: "b", label: "ผิด", correct: false, feedback: "ลองทบทวนอีกครั้ง" }
    ]
  };

  it("returns the selected option's feedback", () => {
    expect(feedbackForAnswer(question, "a")).toBe("ดีมาก");
    expect(feedbackForAnswer(question, "b")).toBe("ลองทบทวนอีกครั้ง");
  });

  it("returns an empty string for an unknown answer", () => {
    expect(feedbackForAnswer(question, "c")).toBe("");
  });
});
