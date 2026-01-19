import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

function toInt(v: any) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : NaN;
}

export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.user_role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const userId = toInt(url.searchParams.get("userId"));
  const course = String(url.searchParams.get("course") ?? "")
    .trim()
    .toLowerCase();

  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }
  if (!course) {
    return NextResponse.json({ error: "course required" }, { status: 400 });
  }

  const rows = await sql<{
    lesson_id: number;
    lesson_title: string;
    difficulty: string | null;

    quiz_post_id: number | null;
    quiz_title: string | null;

    last_attempt_at: Date | null;
    last_score: number | null;
    last_total: number | null;
    last_is_perfect: boolean | null;
  }>`
    WITH lessons AS (
      SELECT
        l.id AS lesson_id,
        l.title AS lesson_title,
        l.difficulty AS difficulty,
        ls.quiz_post_id AS quiz_post_id
      FROM public.posts l
      JOIN public.courses c ON c.id = l.course_id
      LEFT JOIN public.lesson_sets ls ON ls.lesson_id = l.id
      WHERE lower(c.slug) = ${course}
        AND l.type = 'lesson'
    ),
    latest_attempt AS (
      SELECT DISTINCT ON (qa.post_id)
        qa.post_id,
        qa.created_at AS last_attempt_at,
        qa.score AS last_score,
        qa.total_questions AS last_total,
        qa.is_perfect AS last_is_perfect
      FROM public.quiz_attempts qa
      WHERE qa.user_id = ${userId}
      ORDER BY qa.post_id, qa.created_at DESC
    )
    SELECT
      le.lesson_id,
      le.lesson_title,
      le.difficulty,
      le.quiz_post_id,
      q.title AS quiz_title,
      la.last_attempt_at,
      la.last_score,
      la.last_total,
      la.last_is_perfect
    FROM lessons le
    LEFT JOIN public.posts q ON q.id = le.quiz_post_id
    LEFT JOIN latest_attempt la ON la.post_id = le.quiz_post_id
    ORDER BY le.lesson_id ASC
  `;

  return NextResponse.json({ rows });
}
