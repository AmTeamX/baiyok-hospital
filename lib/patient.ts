export type PatientRequestType = "problem" | "consult";
export type PatientRequestStatus = "new" | "acknowledged" | "contacted" | "resolved" | "unable_to_contact";

export const PATIENT_REQUEST_TYPES: PatientRequestType[] = ["problem", "consult"];
export const PATIENT_REQUEST_STATUSES: PatientRequestStatus[] = ["new", "acknowledged", "contacted", "resolved", "unable_to_contact"];

export const PATIENT_REQUEST_REASONS: Record<PatientRequestType, string[]> = {
  problem: ["travel_difficulty", "no_escort", "sick", "work", "other"],
  consult: ["medication", "symptoms", "appointment_question", "other"]
};

export const PATIENT_REQUEST_REASON_LABELS: Record<string, string> = {
  travel_difficulty: "เดินทางไม่สะดวก",
  no_escort: "ไม่มีผู้พามา",
  sick: "ไม่สบาย / มีอาการ",
  work: "ติดงาน / ภารกิจ",
  medication: "มีคำถามเรื่องยา",
  symptoms: "มีอาการผิดปกติ",
  appointment_question: "สอบถามเรื่องวันนัด",
  other: "อื่น ๆ"
};

export const PATIENT_REQUEST_TYPE_LABELS: Record<PatientRequestType, string> = {
  problem: "แจ้งปัญหาการมาตรวจ",
  consult: "ขอคำปรึกษาพยาบาล"
};

export const PATIENT_REQUEST_STATUS_LABELS: Record<PatientRequestStatus, string> = {
  new: "ใหม่",
  acknowledged: "รับเรื่องแล้ว",
  contacted: "ติดต่อแล้ว",
  resolved: "ปิดเรื่องแล้ว",
  unable_to_contact: "ติดต่อไม่ได้"
};

export function isValidPatientRequestType(value: unknown): value is PatientRequestType {
  return typeof value === "string" && (PATIENT_REQUEST_TYPES as string[]).includes(value);
}

export function isValidPatientRequestStatus(value: unknown): value is PatientRequestStatus {
  return typeof value === "string" && (PATIENT_REQUEST_STATUSES as string[]).includes(value);
}

export function isValidPatientRequestReason(type: PatientRequestType, reason: unknown): boolean {
  return typeof reason === "string" && PATIENT_REQUEST_REASONS[type].includes(reason);
}

export type HealthQuestionOption = {
  value: string;
  label: string;
  correct: boolean;
  feedback: string;
};

export type HealthQuestion = {
  id: string;
  prompt: string;
  options: HealthQuestionOption[];
};

export type HealthContent = {
  id: string;
  slug: string;
  title: string;
  body: string;
  imageUrl: string | null;
  imageAlt: string | null;
  version: number;
  questions: HealthQuestion[];
};

/** Extract the correct option's feedback for immediate (non-judgmental) UI feedback. */
export function feedbackForAnswer(question: HealthQuestion, selectedValue: string): string {
  const option = question.options.find((candidate) => candidate.value === selectedValue);
  if (!option) return "";
  return option.feedback || (option.correct ? "ถูกต้องแล้ว" : "ลองทบทวนอีกครั้ง");
}
