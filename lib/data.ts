import { dashboardStats as demoStats, missedPatients, type MissedPatient } from "@/lib/demo-data";
import { createUserClient } from "@/lib/supabase/server";

function thaiDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function ageFromBirthDate(value: string | null) {
  if (!value) return 0; const birth = new Date(value); const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function displayStatus(value?: string): MissedPatient["status"] {
  if (value === "returned" || value === "closed") return "กลับมารับบริการ";
  if (value === "rescheduled") return "นัดใหม่แล้ว";
  if (value === "assigned" || value === "contacted") return "กำลังติดตาม";
  return "รอติดตาม";
}

export async function getMissedPatients(): Promise<{ mode: "demo" | "database"; patients: MissedPatient[] }> {
  const supabase = await createUserClient();
  if (!supabase) return { mode: "demo", patients: missedPatients };
  const { data: appointments, error } = await supabase.from("appointments").select("id, appointment_at, patients!inner(hn, full_name, birth_date, village)").eq("status", "missed").order("appointment_at", { ascending: true }).limit(100);
  if (error) throw error;
  const ids = (appointments ?? []).map(item => item.id);
  const { data: followUps } = ids.length ? await supabase.from("follow_ups").select("appointment_id, status, missed_reason, assigned_volunteer_id").in("appointment_id", ids) : { data: [] };
  const volunteerIds = [...new Set((followUps ?? []).map(item => item.assigned_volunteer_id).filter(Boolean))] as string[];
  const { data: volunteers } = volunteerIds.length ? await supabase.from("profiles").select("id, full_name").in("id", volunteerIds) : { data: [] };
  const followMap = new Map((followUps ?? []).map(item => [item.appointment_id, item])); const volunteerMap = new Map((volunteers ?? []).map(item => [item.id, item.full_name]));
  const now = Date.now();
  const patients = (appointments ?? []).map(item => {
    const patient = Array.isArray(item.patients) ? item.patients[0] : item.patients; const follow = followMap.get(item.id);
    return { id: item.id, hn: patient.hn, name: patient.full_name, age: ageFromBirthDate(patient.birth_date), village: patient.village || "ไม่ระบุหมู่บ้าน", appointment: thaiDate(item.appointment_at), daysLate: Math.max(0, Math.floor((now - new Date(item.appointment_at).getTime()) / 86400000)), reason: follow?.missed_reason || "รอประเมิน", assignee: follow?.assigned_volunteer_id ? volunteerMap.get(follow.assigned_volunteer_id) || "มอบหมายแล้ว" : "ยังไม่มอบหมาย", status: displayStatus(follow?.status) } satisfies MissedPatient;
  });
  return { mode: "database", patients };
}

export async function getDashboardData() {
  const result = await getMissedPatients();
  if (result.mode === "demo") return { ...result, stats: demoStats };
  const supabase = await createUserClient();
  const { data: followUps } = supabase ? await supabase.from("follow_ups").select("status") : { data: [] };
  const statuses = followUps ?? []; const tracked = statuses.filter(item => item.status !== "pending").length; const rescheduled = statuses.filter(item => item.status === "rescheduled").length; const returned = statuses.filter(item => ["returned", "closed"].includes(item.status)).length;
  return { ...result, stats: [
    { label: "ผู้ขาดนัด", value: String(result.patients.length), helper: "ต้องติดตาม", tone: "danger" },
    { label: "ติดตามแล้ว", value: String(tracked), helper: "มีบันทึกการติดตาม", tone: "accent" },
    { label: "นัดใหม่แล้ว", value: String(rescheduled), helper: "รอยืนยันผล", tone: "warning" },
    { label: "กลับมารับบริการ", value: String(returned), helper: "ปิดเคสแล้ว", tone: "success" }
  ] };
}

export async function getMissedPatient(id: string) {
  const result = await getMissedPatients();
  return result.patients.find(patient => patient.id === id) ?? (result.mode === "demo" ? missedPatients[0] : null);
}
