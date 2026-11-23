import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { readContext, readSession } from "@/lib/line/session";

export type PatientIdentity = { patientId: string; fullName: string | null };

export type PatientAuthReason =
  | "unauthorized"
  | "context_required"
  | "context_revoked"
  | "patient_not_found"
  | "database_required";

export type PatientAuthResult =
  | { ok: true; identity: PatientIdentity }
  | { ok: false; reason: PatientAuthReason };

/**
 * Resolve the authenticated patient from the LIFF session + active context.
 * Mirrors requireVolunteer(): the session proves LINE identity, the context
 * proves the selected role is `patient`, and the active link + patient lookup
 * re-verify on every request. The client never supplies the patient id directly.
 */
export async function requirePatient(): Promise<PatientAuthResult> {
  const session = await readSession();
  if (!session) return { ok: false, reason: "unauthorized" };

  const context = await readContext();
  if (!context || context.role !== "patient") return { ok: false, reason: "context_required" };
  if (context.lineAccountId !== session.lineAccountId) return { ok: false, reason: "unauthorized" };

  if (!hasSupabaseAdmin()) return { ok: false, reason: "database_required" };
  const supabase = createAdminClient();

  const { data: link, error: linkError } = await supabase
    .from("line_account_links")
    .select("id, patient_id, status")
    .eq("id", context.linkId)
    .eq("line_account_id", session.lineAccountId)
    .eq("role", "patient")
    .maybeSingle();
  if (linkError || !link || link.status !== "active") return { ok: false, reason: "context_revoked" };

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("id", link.patient_id)
    .maybeSingle();
  if (patientError || !patient) return { ok: false, reason: "patient_not_found" };

  return { ok: true, identity: { patientId: patient.id, fullName: patient.full_name ?? null } };
}

const authStatus: Record<PatientAuthReason, number> = {
  unauthorized: 401,
  context_required: 403,
  context_revoked: 403,
  patient_not_found: 403,
  database_required: 503
};

export function patientAuthStatus(reason: PatientAuthReason): number {
  return authStatus[reason];
}
