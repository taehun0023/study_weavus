import { sql } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type AlertRow = { title: string; detail: string };

export default async function UserAlerts({ userId }: { userId: number }) {
  // 1) 최근 14일 활동 없음
  const inactivity = await sql<{ cnt: number }>`
    SELECT
      COUNT(*)::int as cnt
    FROM (
      SELECT created_at FROM public.quiz_attempts WHERE user_id=${userId} AND created_at >= NOW() - INTERVAL '14 days'
      UNION ALL
      SELECT created_at FROM public.submissions WHERE user_id=${userId} AND created_at >= NOW() - INTERVAL '14 days'
    ) x
  `;

  // 2) 같은 퀴즈 3회 이상 실패(최근 20회에서)
  const repeatFail = await sql<{ quiz_title: string; fails: number }>`
    SELECT p.title as quiz_title, COUNT(*)::int as fails
    FROM public.quiz_attempts qa
    JOIN public.posts p ON p.id = qa.post_id
    WHERE qa.user_id=${userId}
      AND qa.created_at >= NOW() - INTERVAL '30 days'
      AND qa.is_perfect IS FALSE
      AND (qa.score < qa.total_questions)
    GROUP BY p.title
    HAVING COUNT(*) >= 3
    ORDER BY fails DESC
    LIMIT 5
  `;

  const alerts: AlertRow[] = [];
  if ((inactivity[0]?.cnt ?? 0) === 0) {
    alerts.push({
      title: "최근 14일 활동 없음",
      detail: "퀴즈 시도/제출 기록이 없습니다.",
    });
  }
  for (const r of repeatFail) {
    alerts.push({
      title: "반복 실패 감지",
      detail: `${r.quiz_title} · 30일 내 실패 ${r.fails}회`,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">주의/도움 필요 구간</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            감지된 이슈가 없습니다.
          </div>
        ) : (
          alerts.map((a, i) => (
            <div
              key={i}
              className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-medium">{a.title}</div>
                <div className="text-sm text-red-200/80">{a.detail}</div>
              </div>
              <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                주의
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
