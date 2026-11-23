import { NextResponse } from "next/server";
import { createAdminClient, hasSupabaseAdmin } from "@/lib/supabase/admin";
import { requireClinicalStaff } from "@/lib/supabase/server";
import { generateLinkToken, hashLinkToken, linkCodeExpiresAt, type LinkCodeRole, type LinkCodeTargetType } from "@/lib/line/link-code";

type CreateBody = {
  targetType?: string;
  targetId?: string;
  intendedRole?: string;
};

function parseRole(value: string | undefined): LinkCodeRole | null {
  return value === "patient" || value === "volunteer" ? value : null;
}

function parseTargetType(value: string | undefined): LinkCodeTargetType | null {
  return value === "patient" || value === "profile" ? value : null;
}

export async function POST(request: Request) {
  const staff = await requireClinicalStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!hasSupabaseAdmin() || !staff.userId) return NextResponse.json({ ok: false, error: "database_required" }, { status: 503 });

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const targetType = parseTargetType(body.targetType);
  const intendedRole = parseRole(body.intendedRole);
  if (!targetType || !intendedRole || !body.targetId) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 422 });
  }
  if ((intendedRole === "patient") !== (targetType === "patient")) {
    return NextResponse.json({ ok: false, error: "role_target_mismatch" }, { status: 422 });
  }

  const supabase = createAdminClient();

  if (intendedRole === "volunteer") {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, role, active, service_unit_id")
      .eq("id", body.targetId)
      .maybeSingle();
    if (error || !profile || profile.role !== "volunteer" || !profile.active) {
      return NextResponse.json({ ok: false, error: "invalid_volunteer_target" }, { status: 422 });
    }
  } else {
    const { data: patient, error } = await supabase
      .from("patients")
      .select("id")
      .eq("id", body.targetId)
      .maybeSingle();
    if (error || !patient) {
      return NextResponse.json({ ok: false, error: "invalid_patient_target" }, { status: 422 });
    }
  }

  const token = generateLinkToken();
  const { error } = await supabase.from("line_link_codes").insert({
    target_type: targetType,
    target_id: body.targetId,
    intended_role: intendedRole,
    token_hash: hashLinkToken(token),
    expires_at: linkCodeExpiresAt(),
    created_by: staff.userId
  });
  if (error) return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });

  await supabase.from("audit_logs").insert({
    actor_id: staff.userId,
    actor_role: "nurse",
    action: "line_link_code_created",
    entity_type: targetType,
    entity_id: body.targetId,
    after_data: { intended_role: intendedRole }
  });

  return NextResponse.json({ ok: true, token, expiresAt: linkCodeExpiresAt() });
}
