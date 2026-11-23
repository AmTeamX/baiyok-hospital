import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePatient, patientAuthStatus } from "@/lib/line/patient-auth";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const result = await requirePatient();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: patientAuthStatus(result.reason) });
  }

  const body = (await request.json().catch(() => ({}))) as {
    questionId?: unknown;
    selectedValue?: unknown;
    contentVersion?: unknown;
  };
  if (typeof body.questionId !== "string" || !uuidPattern.test(body.questionId)) {
    return NextResponse.json({ ok: false, error: "invalid_question" }, { status: 422 });
  }
  if (typeof body.selectedValue !== "string" || !body.selectedValue.trim()) {
    return NextResponse.json({ ok: false, error: "invalid_answer" }, { status: 422 });
  }
  const contentVersion = Number(body.contentVersion);
  const version = Number.isInteger(contentVersion) && contentVersion > 0 ? contentVersion : 1;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("health_answers")
    .upsert(
      {
        question_id: body.questionId,
        patient_id: result.identity.patientId,
        selected_value: body.selectedValue,
        content_version: version
      },
      { onConflict: "question_id,patient_id" }
    );

  if (error) return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
