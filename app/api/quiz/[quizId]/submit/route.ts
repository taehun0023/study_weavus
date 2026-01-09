import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { quizId } = await params
    const { answers, questionOrder } = await request.json()

    // Get all questions with correct answers
    const questions = await sql`
      SELECT id, correct_answer
      FROM quiz_questions
      WHERE post_id = ${quizId}
    `

    // Calculate score
    let score = 0
    const answerResults: { questionId: number; userAnswer: string; isCorrect: boolean }[] = []

    for (const question of questions) {
      const userAnswer = answers[question.id] || ""
      const isCorrect = userAnswer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase()

      if (isCorrect) score++

      answerResults.push({
        questionId: question.id,
        userAnswer,
        isCorrect,
      })
    }

    const totalQuestions = questions.length
    const isPerfect = score === totalQuestions

    // Create attempt
    const attemptResult = await sql`
      INSERT INTO quiz_attempts (user_id, post_id, score, total_questions, is_perfect, question_order)
      VALUES (${user.id}, ${quizId}, ${score}, ${totalQuestions}, ${isPerfect}, ${JSON.stringify(questionOrder)})
      RETURNING id
    `

    const attemptId = attemptResult[0].id

    // Save individual answers
    for (const result of answerResults) {
      await sql`
        INSERT INTO quiz_attempt_answers (attempt_id, question_id, user_answer, is_correct)
        VALUES (${attemptId}, ${result.questionId}, ${result.userAnswer}, ${result.isCorrect})
      `
    }

    // Update user progress
    const existingProgress = await sql`
      SELECT id, best_score, attempt_count
      FROM user_quiz_progress
      WHERE user_id = ${user.id} AND post_id = ${quizId}
    `

    if (existingProgress.length > 0) {
      const currentBest = existingProgress[0].best_score
      const newBest = Math.max(currentBest, score)
      const completed = newBest === totalQuestions

      await sql`
        UPDATE user_quiz_progress
        SET 
          best_score = ${newBest},
          last_score = ${score},
          completed = ${completed},
          attempt_count = attempt_count + 1,
          updated_at = NOW()
        WHERE user_id = ${user.id} AND post_id = ${quizId}
      `
    } else {
      await sql`
        INSERT INTO user_quiz_progress (user_id, post_id, best_score, last_score, completed, attempt_count)
        VALUES (${user.id}, ${quizId}, ${score}, ${score}, ${isPerfect}, 1)
      `
    }

    return NextResponse.json({
      attemptId,
      score,
      totalQuestions,
      isPerfect,
    })
  } catch (error) {
    console.error("Quiz submit error:", error)
    return NextResponse.json({ error: "퀴즈 제출 중 오류가 발생했습니다." }, { status: 500 })
  }
}
