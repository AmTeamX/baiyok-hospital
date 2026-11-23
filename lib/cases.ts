import type { MissedPriority, MissedStatus } from "@/lib/missed";

export const CASE_STATUS_LABELS: Record<MissedStatus, string> = { pending: "รอมอบหมาย", assigned: "รอ อสม. ดำเนินการ", contacted: "บันทึกผลแล้ว", rescheduled: "นัดใหม่แล้ว", returned: "กลับมารับบริการ", closed: "ปิดเคส" };
export const CASE_PRIORITY_LABELS: Record<MissedPriority, string> = { normal: "ปกติ", high: "สำคัญ", urgent: "เร่งด่วน" };
export const CASE_LINE_LABELS: Record<string, string> = { pending: "รอส่ง LINE", processing: "กำลังส่ง LINE", sent: "LINE รับข้อความแล้ว", failed: "ส่งไม่สำเร็จ", dead_letter: "ต้องส่งซ้ำ", unlinked: "ยังไม่เชื่อม LINE", blocked: "ส่ง LINE ไม่ได้", cancelled: "ยกเลิกข้อความ" };
export type CaseRow = { id: string; status: MissedStatus; priority: MissedPriority; reason: string | null; updatedAt: string; patient: { id: string; name: string; hn: string; village: string | null }; appointment: { at: string; clinic: string }; assignee: { id: string; name: string } | null; notificationStatus: string | null };
