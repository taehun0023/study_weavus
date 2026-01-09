import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { getCurrentUser } from "@/lib/auth"
import { sql } from "@/lib/db"
import DashboardHeader from "@/components/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, ArrowLeft, RotateCcw, Trophy } from "lucide-react"
import { AttemptHistory } from "@/components/attempt-history"

interface ResultPageProps {
  params: Promise<{
    quizId: string
    attemptId: string
  }>
}

export default async function ResultPage({ params }: ResultPageProps) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const { quizId, attemptId } = await params

  // Get attempt info
  const attempts = await sql`
    SELECT 
      qa.id,
      qa.score,
      qa.total_questions,
      qa.is_perfect,
      qa.question_order,
      qa.created_at,
      p.title as quiz_title,
      c.slug as course_slug
    FROM quiz_attempts qa
    JOIN posts p ON qa.post_id = p.id
    JOIN courses c ON p.course_id = c.id
    WHERE qa.id = ${attemptId} AND qa.user_id = ${user.id}
  `

  const attempt = attempts[0]

  if (!attempt) {
    notFound()
  }

  // Get answers with questions in the order they were presented
  const questionOrder = attempt.question_order as number[]

  const allAnswers = await sql`
    SELECT 
      qaa.question_id,
      qaa.user_answer,
      qaa.is_correct,
      qq.question_text,
      qq.question_type,
      qq.options,
      qq.correct_answer,
      qq.explanation
    FROM quiz_attempt_answers qaa
    JOIN quiz_questions qq ON qaa.question_id = qq.id
    WHERE qaa.attempt_id = ${attemptId}
  `

  // Sort answers by the question_order from the attempt
  const sortedAnswers = questionOrder.map((qId) => allAnswers.find((a) => a.question_id === qId)).filter(Boolean)

  const scorePercent = Math.round((attempt.score / attempt.total_questions) * 100)

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <Link href={`/posts?course=${attempt.course_slug}`}>
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              목록으로
            </Button>
          </Link>
        </div>

        {/* Score Summary */}
        <Card className={`border-2 ${attempt.is_perfect ? "border-green-500/50 bg-green-500/5" : "border-border"}`}>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              {attempt.is_perfect && (
                <div className="flex justify-center">
                  <div className="p-3 rounded-full bg-green-500/20">
                    <Trophy className="h-8 w-8 text-green-500" />
                  </div>
                </div>
              )}
              <h2 className="text-2xl font-bold text-foreground">{attempt.quiz_title}</h2>
              <div className="text-5xl font-bold text-foreground">
                {attempt.score} / {attempt.total_questions}
              </div>
              <div className="text-xl text-muted-foreground">{scorePercent}점</div>
              {attempt.is_perfect && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-lg px-4 py-1">
                  만점 달성! 완료 처리됨
                </Badge>
              )}
              <div className="pt-4">
                <Link href={`/quiz/${quizId}`}>
                  <Button>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    다시 풀기
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Question Results */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">문제별 결과</h3>
          {sortedAnswers.map((answer, index) => (
            <Card
              key={answer.question_id}
              className={`border ${answer.is_correct ? "border-green-500/30" : "border-red-500/30"}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base text-foreground flex items-center gap-2">
                    <span className="text-muted-foreground">Q{index + 1}.</span>
                    {answer.question_text}
                  </CardTitle>
                  {answer.is_correct ? (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      정답
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                      <XCircle className="h-3 w-3 mr-1" />
                      오답
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="p-3 rounded-lg bg-secondary/50">
                    <p className="text-sm text-muted-foreground mb-1">내 답</p>
                    <p className={`font-medium ${answer.is_correct ? "text-green-400" : "text-red-400"}`}>
                      {answer.user_answer || "(미응답)"}
                    </p>
                  </div>
                  {!answer.is_correct && (
                    <div className="p-3 rounded-lg bg-green-500/10">
                      <p className="text-sm text-muted-foreground mb-1">정답</p>
                      <p className="font-medium text-green-400">{answer.correct_answer}</p>
                    </div>
                  )}
                </div>
                {answer.explanation && (
                  <div className="p-3 rounded-lg bg-card border border-border">
                    <p className="text-sm text-muted-foreground mb-1">해설</p>
                    <p className="text-foreground">{answer.explanation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Attempt History */}
        <AttemptHistory quizId={Number(quizId)} userId={user.id} currentAttemptId={Number(attemptId)} />
      </main>
    </div>
  )
}
