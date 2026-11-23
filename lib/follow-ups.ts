export const MISSED_REASONS = [
  "ลืมวันนัด",
  "เดินทางไม่สะดวก",
  "ไม่มีอาการจึงคิดว่าหาย",
  "กังวลค่าใช้จ่าย",
  "ติดงาน/ดูแลครอบครัว",
  "มีอาการป่วยอื่น",
  "อื่น ๆ"
] as const;

export const NURSING_ACTIVITIES = [
  "โทรศัพท์ติดตาม",
  "มอบหมาย อสม. เยี่ยมบ้าน",
  "ให้คำปรึกษาเรื่องยา",
  "ให้สื่อสุขภาพ",
  "ประสานคลินิกนัดใหม่"
] as const;

export const FOLLOW_UP_PRIORITIES = ["normal", "high", "urgent"] as const;

export function isValidMissedReason(value: string): boolean {
  return MISSED_REASONS.includes(value as (typeof MISSED_REASONS)[number]);
}

export function isValidNursingActivity(value: string): boolean {
  return NURSING_ACTIVITIES.includes(value as (typeof NURSING_ACTIVITIES)[number]);
}

export function isValidPriority(value: string): value is "normal" | "high" | "urgent" {
  return FOLLOW_UP_PRIORITIES.includes(value as (typeof FOLLOW_UP_PRIORITIES)[number]);
}

export function normalizePriority(value: unknown): "normal" | "high" | "urgent" {
  return typeof value === "string" && isValidPriority(value) ? value : "normal";
}
