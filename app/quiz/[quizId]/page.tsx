import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { sql } from "@/lib/db"
import { DashboardHeader } from "@/components/dashboard-header"
import { QuizContainer } from "@/components/quiz-container"

interface QuizPageProps {
  params: Promise<{
    quizId: string
  }>
}

export default async function QuizPage({ params }: QuizPageProps) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const { quizId } = await params

  // Get quiz info
  const quizzes = await sql`
    SELECT 
      p.id,
      p.title,
      p.difficulty,
      c.name as course_name,
      c.slug as course_slug
    FROM posts p
    JOIN courses c ON p.course_id = c.id
    WHERE p.id = ${quizId} AND p.type = 'quiz'
  `

  const quiz = quizzes[0]

  if (!quiz) {
    notFound()
  }

  // Get questions (will be randomized on client)
  const questions = await sql`
    SELECT 
      id,
      question_text,
      question_type,
      options
    FROM quiz_questions
    WHERE post_id = ${quizId}
    ORDER BY order_index
  `

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <QuizContainer
          quiz={{
            id: quiz.id,
            title: quiz.title,
            difficulty: quiz.difficulty,
            courseName: quiz.course_name,
            courseSlug: quiz.course_slug,
          }}
          questions={questions.map((q) => ({
            id: q.id,
            questionText: q.question_text,
            questionType: q.question_type,
            options: q.options,
          }))}
        />
      </main>
    </div>
  )
}
