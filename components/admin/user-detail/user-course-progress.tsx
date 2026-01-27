import { sql } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type CourseRow = {
  course_id: number;
  course_slug: string;
  course_name: string;
  lessons_total: number;
  lessons_with_quiz: number;
  quizzes_total_linked: number;
  quizzes_completed: number;
};

type LessonRow = {
  lesson_id: number;
  lesson_title: string;
  difficulty: string | null;
  quiz_post_id: number | null;
  quiz_title: string | null;
  completed: boolean | null;
  best_score: number | null;
  total_questions: number | null;
};

export default async function UserCourseProgress({
  userId,
}: {
  userId: number;
}) {
  // 과목별 요약
  const courses = await sql<CourseRow>`
    WITH lesson_base AS (
      SELECT p.id AS lesson_id, p.course_id
      FROM public.posts p
      WHERE p.type='lesson'
    ),
    lesson_quiz AS (
      SELECT lb.course_id, ls.lesson_id, ls.quiz_post_id
      FROM lesson_base lb
      LEFT JOIN public.lesson_sets ls ON ls.lesson_id = lb.lesson_id
    )
    SELECT
      c.id AS course_id,
      c.slug AS course_slug,
      c.name AS course_name,
      COUNT(DISTINCT lq.lesson_id)::int AS lessons_total,
      COUNT(DISTINCT lq.lesson_id) FILTER (WHERE lq.quiz_post_id IS NOT NULL)::int AS lessons_with_quiz,
      COUNT(DISTINCT lq.quiz_post_id) FILTER (WHERE lq.quiz_post_id IS NOT NULL)::int AS quizzes_total_linked,
      COUNT(DISTINCT uqp.post_id) FILTER (WHERE uqp.completed IS TRUE)::int AS quizzes_completed
    FROM public.courses c
    LEFT JOIN lesson_quiz lq ON lq.course_id = c.id
    LEFT JOIN public.user_quiz_progress uqp
      ON uqp.user_id = ${userId} AND uqp.post_id = lq.quiz_post_id
    GROUP BY c.id, c.slug, c.name
    ORDER BY c.id ASC
  `;

  // 과목별 상세(수업 리스트)
  // ✅ total_questions는 user_quiz_progress에 없으니 quiz_questions에서 COUNT로 계산
  const lessons = await sql<LessonRow>`
    SELECT
      l.id AS lesson_id,
      l.title AS lesson_title,
      l.difficulty,
      ls.quiz_post_id,
      q.title AS quiz_title,
      uqp.completed,
      uqp.best_score,
      tq.total_questions
    FROM public.posts l
    JOIN public.courses c ON c.id = l.course_id
    LEFT JOIN public.lesson_sets ls ON ls.lesson_id = l.id
    LEFT JOIN public.posts q ON q.id = ls.quiz_post_id
    LEFT JOIN public.user_quiz_progress uqp
      ON uqp.user_id = ${userId} AND uqp.post_id = ls.quiz_post_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS total_questions
      FROM public.quiz_questions qq
      WHERE qq.post_id = ls.quiz_post_id
    ) tq ON TRUE
    WHERE l.type='lesson'
    ORDER BY c.id ASC, l.id ASC
  `;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">과목별 진행 현황</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {courses.map((c) => {
          const pct =
            c.quizzes_total_linked > 0
              ? Math.round((c.quizzes_completed / c.quizzes_total_linked) * 100)
              : 0;

          return (
            <details
              key={c.course_id}
              className="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <summary className="cursor-pointer flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{c.course_name}</Badge>
                <div className="text-sm text-muted-foreground">
                  퀴즈 완료: {c.quizzes_completed}/{c.quizzes_total_linked} (
                  {pct}%)
                </div>
                <div className="text-xs text-muted-foreground">
                  수업: {c.lessons_total} · 퀴즈 연결 수업:{" "}
                  {c.lessons_with_quiz}
                </div>
              </summary>

              <div className="mt-4 grid gap-2">
                {lessons.map((l) => (
                  <div
                    key={l.lesson_id}
                    className="rounded-lg border border-white/10 bg-black/20 p-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {l.lesson_title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        퀴즈:{" "}
                        {l.quiz_post_id
                          ? (l.quiz_title ?? `#${l.quiz_post_id}`)
                          : "없음"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {l.quiz_post_id ? (
                        l.completed ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            완료
                          </Badge>
                        ) : (
                          <Badge variant="outline">미완료</Badge>
                        )
                      ) : (
                        <Badge variant="secondary">퀴즈 미연결</Badge>
                      )}

                      {l.quiz_post_id && (l.total_questions ?? 0) > 0 ? (
                        <div className="text-xs text-muted-foreground">
                          {l.best_score ?? 0}/{l.total_questions}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </CardContent>
    </Card>
  );
}
