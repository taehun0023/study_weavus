import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

type Body = {
  lessonId: number;
  referencePostId?: number | null;
  quizPostId?: number | null;
};

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (user.user_role !== "ADMIN")
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({} as Body))) as Partial<Body>;

  const lessonId = Number(body.lessonId ?? NaN);
  const referencePostId =
    body.referencePostId == null ? null : Number(body.referencePostId);
  const quizPostId = body.quizPostId == null ? null : Number(body.quizPostId);

  if (!Number.isFinite(lessonId) || lessonId <= 0) {
    return NextResponse.json({ message: "Invalid lessonId" }, { status: 400 });
  }

  // lesson인지 확인
  const [lesson] = await sql<{ id: number }>`
    SELECT id FROM public.posts
    WHERE id = ${lessonId} AND type = 'lesson'
    LIMIT 1
  `;
  if (!lesson)
    return NextResponse.json({ message: "Not a lesson" }, { status: 400 });

  // reference/quiz 검증(선택된 경우에만)
  if (referencePostId) {
    const [ref] = await sql<{ id: number }>`
      SELECT id FROM public.posts WHERE id = ${referencePostId} AND type='reference' LIMIT 1
    `;
    if (!ref)
      return NextResponse.json(
        { message: "Invalid referencePostId" },
        { status: 400 }
      );
  }
  if (quizPostId) {
    const [quiz] = await sql<{ id: number }>`
      SELECT id FROM public.posts WHERE id = ${quizPostId} AND type='quiz' LIMIT 1
    `;
    if (!quiz)
      return NextResponse.json(
        { message: "Invalid quizPostId" },
        { status: 400 }
      );
  }

  await sql`
    INSERT INTO public.lesson_sets (lesson_id, reference_post_id, quiz_post_id)
    VALUES (${lessonId}, ${referencePostId}, ${quizPostId})
    ON CONFLICT (lesson_id)
    DO UPDATE SET
      reference_post_id = EXCLUDED.reference_post_id,
      quiz_post_id = EXCLUDED.quiz_post_id,
      updated_at = CURRENT_TIMESTAMP
  `;

  return NextResponse.json({ ok: true });
}
