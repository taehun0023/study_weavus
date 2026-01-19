import { sql } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Row = {
  kind: "quiz" | "submission";
  at: Date;
  title: string;
  meta: string | null;
};

export default async function UserRecentTimeline({
  userId,
}: {
  userId: number;
}) {
  const rows = await sql<Row>`
    (
      SELECT
        'quiz'::text as kind,
        qa.created_at as at,
        p.title as title,
        CASE
          WHEN qa.is_perfect THEN '만점'
          ELSE (qa.score::text || '/' || qa.total_questions::text)
        END as meta
      FROM public.quiz_attempts qa
      JOIN public.posts p ON p.id = qa.post_id
      WHERE qa.user_id = ${userId}
      ORDER BY qa.created_at DESC
      LIMIT 10
    )
    UNION ALL
    (
      SELECT
        'submission'::text as kind,
        s.created_at as at,
        ('수업 제출물 #' || s.lesson_id::text) as title,
        NULL as meta
      FROM public.submissions s
      WHERE s.user_id = ${userId}
      ORDER BY s.created_at DESC
      LIMIT 10
    )
    ORDER BY at DESC
    LIMIT 12
  `;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">최근 학습 타임라인</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            최근 기록이 없습니다.
          </div>
        ) : (
          rows.map((r, i) => (
            <div
              key={i}
              className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{r.title}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.at).toLocaleString()}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {r.kind === "quiz" ? "퀴즈" : "제출"}
                </Badge>
                {r.meta ? (
                  <Badge variant="outline" className="whitespace-nowrap">
                    {r.meta}
                  </Badge>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
