import { sql } from "@/lib/db"
import { formatDateTime } from "@/lib/datetime"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { History, Trophy, Clock } from "lucide-react"

interface AttemptHistoryProps {
  quizId: number
  userId: number
  currentAttemptId: number
}

export async function AttemptHistory({ quizId, userId, currentAttemptId }: AttemptHistoryProps) {
  const attempts = await sql`
    SELECT 
      id,
      score,
      total_questions,
      is_perfect,
      created_at
    FROM quiz_attempts
    WHERE post_id = ${quizId} AND user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 10
  `

  // Get best score
  const bestScore = Math.max(...attempts.map((a) => a.score))

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <History className="h-5 w-5" />
          시도 기록
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {attempts.map((attempt, index) => {
            const isCurrent = attempt.id === currentAttemptId
            const isBest = attempt.score === bestScore

            return (
              <li
                key={attempt.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isCurrent ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">#{attempts.length - index}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {attempt.score} / {attempt.total_questions}
                      </span>
                      {attempt.is_perfect && <Trophy className="h-4 w-4 text-green-500" />}
                      {isBest && !attempt.is_perfect && (
                        <Badge variant="outline" className="text-xs">
                          최고점
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(attempt.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isCurrent && (
                    <Badge variant="secondary" className="text-xs">
                      현재
                    </Badge>
                  )}
                  {attempt.is_perfect && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">만점</Badge>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
