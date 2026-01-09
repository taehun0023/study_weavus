import { sql } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Trophy } from "lucide-react"

interface OverallProgressProps {
  userId: number
}

export async function OverallProgress({ userId }: OverallProgressProps) {
  // Get total quiz count and completed (perfect score) count
  const stats = await sql`
    SELECT 
      COUNT(DISTINCT p.id) as total_quizzes,
      COUNT(DISTINCT CASE WHEN uqp.completed = true THEN p.id END) as completed_quizzes
    FROM posts p
    LEFT JOIN user_quiz_progress uqp ON p.id = uqp.post_id AND uqp.user_id = ${userId}
    WHERE p.type = 'quiz'
  `

  const totalQuizzes = Number(stats[0]?.total_quizzes) || 0
  const completedQuizzes = Number(stats[0]?.completed_quizzes) || 0
  const progressPercent = totalQuizzes > 0 ? Math.round((completedQuizzes / totalQuizzes) * 100) : 0

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Trophy className="h-5 w-5 text-chart-4" />
          전체 학습 진척도
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            완료한 퀴즈: {completedQuizzes} / {totalQuizzes}
          </span>
          <span className="text-2xl font-bold text-foreground">{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-3" />
        <p className="text-sm text-muted-foreground">만점(100점)을 받은 퀴즈만 완료로 인정됩니다.</p>
      </CardContent>
    </Card>
  )
}
