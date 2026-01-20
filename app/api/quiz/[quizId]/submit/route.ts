import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

type Body =
  | {
      answers?: Record<string, any>;
      questionOrder?: any;
    }
  | any;

// ✅ options 파싱(배열/JSON 문자열/기타 형태 방어)
function parseOptions(raw: any): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v));
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v));
    } catch {
      // ignore
    }
  }
  return [];
}

function toFiniteInt(v: any): number | null {
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

// ✅ 답안 비교 정규화
// - 줄바꿈 형태만 통일(Windows CRLF -> LF)
// - 앞/뒤 공백만 제거
// - 대소문자 구분(사용자 입력 그대로 평가)
function normalizeForCompare(input: any) {
  return String(input ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
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

      const opts = parseOptions(q.options);

      // ✅ 객관식: index(숫자/숫자문자열)로 오면 옵션 문자열로 변환
      const maybeIdx = toFiniteInt(userAnswerRaw);
      const userIndex =
        opts.length > 0 && maybeIdx != null && maybeIdx >= 0
          ? maybeIdx
          : null;
      const userAnswer =
        userIndex != null ? String(opts[userIndex] ?? "") : String(userAnswerRaw ?? "");

      // ✅ 정답이 "인덱스"로 저장돼 있든, "옵션 텍스트"로 저장돼 있든 둘 다 지원
      const correctRaw = q.correct_answer ?? "";
      const correctIdxFromValue = toFiniteInt(correctRaw);
      const correctIndex =
        opts.length > 0
          ? correctIdxFromValue != null
            ? correctIdxFromValue
            : opts.findIndex((x) => normalizeForCompare(x) === normalizeForCompare(correctRaw))
          : -1;

      const isCorrect =
        // 1) 인덱스로 비교 가능하면 인덱스 비교가 최우선(가장 안정적)
        correctIndex >= 0 && userIndex != null
          ? userIndex === correctIndex
          : // 2) 아니면 텍스트 비교(서술형/객관식 텍스트 저장 모두 커버)
            normalizeForCompare(userAnswer) === normalizeForCompare(correctRaw);

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
