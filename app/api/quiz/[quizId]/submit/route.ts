import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

type Body =
  | {
      answers?: Record<string, any>;
      questionOrder?: any;
    }
  | any;

// ✅ NEW: 답안 비교 정규화(여러 줄/공백 허용 + 대소문자 무시)
function normalizeForCompare(input: any) {
  const s = String(input ?? "");

  // 줄바꿈/탭/여러 공백 -> 공백 1개로 압축
  // 예: "a \n  b"  -> "a b"
  const collapsed = s.replace(/\s+/g, " ").trim();

  // 대소문자 무시
  return collapsed.toLowerCase();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { quizId } = await params;
    const body = (await request.json().catch(() => ({}))) as Body;

    // ✅ questions: options까지 포함(방어용)
    const questions = await sql<{
      id: number;
      correct_answer: string;
      options: any;
    }>`
      SELECT id, correct_answer, options
      FROM quiz_questions
      WHERE post_id = ${quizId}
      ORDER BY order_index ASC, id ASC
    `;

    // ✅ questionOrder가 없으면 기본값 세팅 (NOT NULL 방지)
    const fallbackOrder = questions.map((q) => q.id);
    const questionOrder =
      Array.isArray(body?.questionOrder) && body.questionOrder.length > 0
        ? body.questionOrder
            .map((x: any) => Number(x))
            .filter((n: any) => Number.isFinite(n))
        : fallbackOrder;

    // answers는 object가 정석인데, 혹시 배열이면 변환
    const answersIn = body?.answers;
    const answersObj: Record<string, any> = Array.isArray(answersIn)
      ? Object.fromEntries(
          answersIn
            .map((a: any) => [
              String(a.questionId ?? a.question_id ?? ""),
              a.value ?? a.userAnswer ?? "",
            ])
            .filter(([k]: any) => k)
        )
      : typeof answersIn === "object" && answersIn
      ? answersIn
      : {};

    // 채점
    let score = 0;
    const answerResults: {
      questionId: number;
      userAnswer: string;
      isCorrect: boolean;
    }[] = [];

    for (const q of questions) {
      let userAnswerRaw = answersObj[String(q.id)] ?? "";

      // index로 오면 options로 변환
      if (typeof userAnswerRaw === "number") {
        const opts = Array.isArray(q.options) ? q.options : [];
        userAnswerRaw = opts[userAnswerRaw] ?? "";
      }

      const userAnswer = String(userAnswerRaw ?? "");

      // ✅ NEW: 공백/줄바꿈 허용 비교
      const isCorrect =
        normalizeForCompare(userAnswer) ===
        normalizeForCompare(q.correct_answer ?? "");

      if (isCorrect) score++;

      answerResults.push({
        questionId: q.id,
        userAnswer,
        isCorrect,
      });
    }

    const totalQuestions = questions.length;
    const isPerfect = totalQuestions > 0 && score === totalQuestions;

    // ✅ 반드시 JSON 문자열로 저장
    const attemptResult = await sql<{ id: number }>`
      INSERT INTO quiz_attempts (user_id, post_id, score, total_questions, is_perfect, question_order)
      VALUES (${
        user.id
      }, ${quizId}, ${score}, ${totalQuestions}, ${isPerfect}, ${JSON.stringify(
      questionOrder
    )})
      RETURNING id
    `;
    const attemptId = attemptResult[0].id;

    for (const r of answerResults) {
      await sql`
        INSERT INTO quiz_attempt_answers (attempt_id, question_id, user_answer, is_correct)
        VALUES (${attemptId}, ${r.questionId}, ${r.userAnswer}, ${r.isCorrect})
      `;
    }

    // progress update
    const existingProgress = await sql<{
      id: number;
      best_score: number;
      attempt_count: number;
    }>`
      SELECT id, best_score, attempt_count
      FROM user_quiz_progress
      WHERE user_id = ${user.id} AND post_id = ${quizId}
    `;

    if (existingProgress.length > 0) {
      const currentBest = existingProgress[0].best_score;
      const newBest = Math.max(currentBest, score);
      const completed = totalQuestions > 0 && newBest === totalQuestions;

      await sql`
        UPDATE user_quiz_progress
        SET 
          best_score = ${newBest},
          last_score = ${score},
          completed = ${completed},
          attempt_count = attempt_count + 1,
          updated_at = NOW()
        WHERE user_id = ${user.id} AND post_id = ${quizId}
      `;
    } else {
      await sql`
        INSERT INTO user_quiz_progress (user_id, post_id, best_score, last_score, completed, attempt_count)
        VALUES (${user.id}, ${quizId}, ${score}, ${score}, ${isPerfect}, 1)
      `;
    }

    return NextResponse.json({ attemptId, score, totalQuestions, isPerfect });
  } catch (error) {
    console.error("Quiz submit error:", error);
    return NextResponse.json(
      { error: "퀴즈 제출 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
