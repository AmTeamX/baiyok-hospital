import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { readContext, readSession } from "@/lib/line/session";

export type VolunteerIdentity = { profileId: string; fullName: string; serviceUnitId: string | null };

export type VolunteerAuthReason =
  | "unauthorized"
  | "context_required"
  | "context_revoked"
  | "not_volunteer"
  | "inactive"
  | "database_required";

export type VolunteerAuthResult =
  | { ok: true; identity: VolunteerIdentity }
  | { ok: false; reason: VolunteerAuthReason };

/**
 * Resolve the authenticated volunteer from the LIFF session + active context.
 *
 * Every volunteer API must go through this gate: the session proves the LINE
 * identity, the context proves the selected role is `volunteer`, and the link +
 * profile lookups re-verify (on every request) that the link is still active and
 * the profile is an active volunteer. The client never supplies role or profile
 * id directly — both come from signed, server-issued cookies.
 */
export async function requireVolunteer(): Promise<VolunteerAuthResult> {
  const session = await readSession();
  if (!session) return { ok: false, reason: "unauthorized" };

  const context = await readContext();
  if (!context || context.role !== "volunteer") return { ok: false, reason: "context_required" };
  if (context.lineAccountId !== session.lineAccountId) return { ok: false, reason: "unauthorized" };

  if (!hasSupabaseAdmin()) return { ok: false, reason: "database_required" };
  const supabase = createAdminClient();

  const { data: link, error: linkError } = await supabase
    .from("line_account_links")
    .select("id, profile_id, status")
    .eq("id", context.linkId)
    .eq("line_account_id", session.lineAccountId)
    .eq("role", "volunteer")
    .maybeSingle();
  if (linkError || !link || link.status !== "active") return { ok: false, reason: "context_revoked" };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, active, service_unit_id")
    .eq("id", link.profile_id)
    .eq("role", "volunteer")
    .maybeSingle();
  if (profileError || !profile) return { ok: false, reason: "not_volunteer" };
  if (!profile.active) return { ok: false, reason: "inactive" };

  return {
    ok: true,
    identity: { profileId: profile.id, fullName: profile.full_name, serviceUnitId: profile.service_unit_id ?? null }
  };
}

const authStatus: Record<VolunteerAuthReason, number> = {
  unauthorized: 401,
  context_required: 403,
  context_revoked: 403,
  not_volunteer: 403,
  inactive: 403,
  database_required: 503
};

export function volunteerAuthStatus(reason: VolunteerAuthReason): number {
  return authStatus[reason];
}
