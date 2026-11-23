export type MissedPatient = {
  id: string; hn: string; name: string; age: number; village: string; appointment: string;
  daysLate: number; reason: string; assignee: string; status: "รอติดตาม" | "กำลังติดตาม" | "นัดใหม่แล้ว" | "กลับมารับบริการ";
};

export const missedPatients: MissedPatient[] = [
  { id: "pt-001", hn: "12345", name: "นางสาวสมใจ ใจดี", age: 61, village: "หมู่ 4 บ้านโนน", appointment: "18 พ.ย. 2569", daysLate: 5, reason: "เดินทางไม่สะดวก", assignee: "อสม. มาลี", status: "กำลังติดตาม" },
  { id: "pt-002", hn: "23108", name: "นายประเสริฐ แสงทอง", age: 67, village: "หมู่ 2 บ้านใหม่", appointment: "20 พ.ย. 2569", daysLate: 3, reason: "ลืมวันนัด", assignee: "ยังไม่มอบหมาย", status: "รอติดตาม" },
  { id: "pt-003", hn: "34021", name: "นางบัวผัน คำดี", age: 72, village: "หมู่ 7 บ้านดอน", appointment: "21 พ.ย. 2569", daysLate: 2, reason: "ไม่มีอาการ", assignee: "อสม. ชาญ", status: "นัดใหม่แล้ว" },
  { id: "pt-004", hn: "41889", name: "นายวิชัย พูนผล", age: 58, village: "หมู่ 1 บ้านกลาง", appointment: "22 พ.ย. 2569", daysLate: 1, reason: "ติดงาน", assignee: "อสม. นิด", status: "กลับมารับบริการ" }
];

export const dashboardStats = [
  { label: "ผู้ขาดนัด", value: "15", helper: "ต้องติดตาม", tone: "danger" },
  { label: "ติดตามแล้ว", value: "9", helper: "60% ของทั้งหมด", tone: "accent" },
  { label: "นัดใหม่แล้ว", value: "6", helper: "รอยืนยันผล", tone: "warning" },
  { label: "กลับมารับบริการ", value: "5", helper: "ปิดเคสแล้ว", tone: "success" }
];
