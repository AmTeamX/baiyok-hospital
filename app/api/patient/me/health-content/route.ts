import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePatient, patientAuthStatus } from "@/lib/line/patient-auth";
import type { HealthContent, HealthQuestion, HealthQuestionOption } from "@/lib/patient";

export const runtime = "nodejs";

export async function GET() {
  const result = await requirePatient();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: patientAuthStatus(result.reason) });
  }

  const supabase = createAdminClient();
  const { data: contents, error } = await supabase
    .from("health_contents")
    .select("id, slug, title, body, image_url, image_alt, version")
    .eq("published", true)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });

  const contentIds = (contents ?? []).map((content) => content.id);
  const { data: questions } = contentIds.length
    ? await supabase
        .from("health_questions")
        .select("id, content_id, prompt, options, sort_order")
        .in("content_id", contentIds)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const questionsByContent = new Map<string, HealthQuestion[]>();
  for (const question of (questions ?? []) as Array<{ id: string; content_id: string; prompt: string; options: unknown; sort_order: number }>) {
    const mapped: HealthQuestion = {
      id: question.id,
      prompt: question.prompt,
      options: Array.isArray(question.options) ? (question.options as HealthQuestionOption[]) : []
    };
    const list = questionsByContent.get(question.content_id) ?? [];
    list.push(mapped);
    questionsByContent.set(question.content_id, list);
  }

  const items: HealthContent[] = (contents ?? []).map((content) => ({
    id: content.id,
    slug: content.slug,
    title: content.title,
    body: content.body,
    imageUrl: content.image_url ?? null,
    imageAlt: content.image_alt ?? null,
    version: Number(content.version ?? 1),
    questions: questionsByContent.get(content.id) ?? []
  }));

  return NextResponse.json({ ok: true, contents: items });
}
