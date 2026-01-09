import { sql } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle, Star } from "lucide-react"

interface RecentActivityProps {
  userId: number
}

export async function RecentActivity({ userId }: RecentActivityProps) {
  // Get recent quiz attempts
  const recentAttempts = await sql`
    SELECT 
      qa.id,
      qa.score,
      qa.total_questions,
      qa.is_perfect,
      qa.created_at,
      p.title as quiz_title,
      p.id as post_id
    FROM quiz_attempts qa
    JOIN posts p ON qa.post_id = p.id
    WHERE qa.user_id = ${userId}
    ORDER BY qa.created_at DESC
    LIMIT 5
  `

  // Get recent perfect scores
  const recentPerfects = await sql`
    SELECT 
      qa.id,
      qa.created_at,
      p.title as quiz_title,
      p.id as post_id
    FROM quiz_attempts qa
    JOIN posts p ON qa.post_id = p.id
    WHERE qa.user_id = ${userId} AND qa.is_perfect = true
    ORDER BY qa.created_at DESC
    LIMIT 3
  `

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Clock className="h-5 w-5 text-chart-1" />
            최근 학습 활동
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentAttempts.length === 0 ? (
            <p className="text-muted-foreground text-sm">아직 학습 기록이 없습니다.</p>
          ) : (
            <ul className="space-y-3">
              {recentAttempts.map((attempt) => (
                <li
                  key={attempt.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <p className="font-medium text-foreground">{attempt.quiz_title}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(attempt.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={attempt.is_perfect ? "default" : "secondary"}>
                      {attempt.score}/{attempt.total_questions}
                    </Badge>
                    {attempt.is_perfect && <CheckCircle className="h-4 w-4 text-green-500" />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Star className="h-5 w-5 text-chart-4" />
            최근 만점 달성
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentPerfects.length === 0 ? (
            <p className="text-muted-foreground text-sm">아직 만점 기록이 없습니다.</p>
          ) : (
            <ul className="space-y-3">
              {recentPerfects.map((perfect) => (
                <li
                  key={perfect.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <p className="font-medium text-foreground">{perfect.quiz_title}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(perfect.created_at)}</p>
                  </div>
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/30">만점</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
