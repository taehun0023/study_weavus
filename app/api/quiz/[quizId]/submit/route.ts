import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { parseOptions } from "@/lib/quiz/parseOptions";

type Body =
  | {
      answers?: Record<string, any>;
      questionOrder?: any;
    }
  | any;

// ✅ 빈값 판정: "미작성"을 명확히 구분
function isBlank(v: any): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

// ✅ 숫자 변환: "" -> 0 되는 버그 방지
function toFiniteInt(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

// ✅ 답안 비교 정규화 (기존 로직 유지)
function normalizeForCompare(input: any) {
  return String(input ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { quizId } = await params;
    const body = (await request.json().catch(() => ({}))) as Body;

    const questions = await sql<{
      id: number;
      correct_answer: string;
      options: any;
      question_type: string;
    }>`
      SELECT id, correct_answer, options, question_type
      FROM quiz_questions
      WHERE post_id = ${quizId}
      ORDER BY order_index ASC, id ASC
    `;

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
            .filter(([k]: any) => k),
        )
      : typeof answersIn === "object" && answersIn
        ? answersIn
        : {};

    // 채점
    let score = 0;
    const answerResults: {
      questionId: number;
      userAnswer: string | null;
      answerState: "unanswered" | "answered";
      isCorrect: boolean;
    }[] = [];

    for (const q of questions) {
      const userAnswerRaw = answersObj[String(q.id)];

      const unanswered = isBlank(userAnswerRaw);
      const opts = parseOptions(q.options);

      // ✅ 객관식: index로 오면 옵션 문자열로 변환 (단, 미작성은 제외)
      const maybeIdx = unanswered ? null : toFiniteInt(userAnswerRaw);

      const userIndex =
        !unanswered && opts.length > 0 && maybeIdx != null && maybeIdx >= 0
          ? maybeIdx
          : null;

      // index 범위 밖은 "미작성"으로 처리(잘못된 payload 방어)
      const normalizedUserIndex =
        userIndex != null && userIndex < opts.length ? userIndex : null;

      const userAnswerText = unanswered
        ? ""
        : normalizedUserIndex != null
          ? String(opts[normalizedUserIndex] ?? "")
          : String(userAnswerRaw ?? "");

      // ✅ 정답이 index/텍스트 둘 다 지원
      const correctRaw = q.correct_answer ?? "";
      const correctIdxFromValue = toFiniteInt(correctRaw);

      const correctIndex =
        opts.length > 0
          ? correctIdxFromValue != null
            ? correctIdxFromValue
            : opts.findIndex(
                (x) =>
                  normalizeForCompare(x) === normalizeForCompare(correctRaw),
              )
          : -1;

      // ✅ 가장 중요: 미작성은 무조건 오답

      const isCorrect = (() => {
        if (unanswered) return false;

        // multiple_choice: 기본은 단일 정답(index). (레거시: 보기 텍스트도 허용)
        if (q.question_type === "multiple_choice") {
          return (
            (normalizedUserIndex != null &&
              String(normalizedUserIndex) === String(correctRaw).trim()) ||
            normalizeForCompare(userAnswerText) ===
              normalizeForCompare(correctRaw)
          );
        }

        // true_false (O/X): DB는 "true"/"false" 또는 "1"/"0" 저장을 허용
        if (q.question_type === "true_false") {
          const u = normalizeForCompare(userAnswerText).toLowerCase();
          const c = normalizeForCompare(correctRaw).toLowerCase();

          const uNorm =
            u === "o" || u === "true" || u === "1"
              ? "true"
              : u === "x" || u === "false" || u === "0"
                ? "false"
                : u;

          const cNorm =
            c === "o" || c === "true" || c === "1"
              ? "true"
              : c === "x" || c === "false" || c === "0"
                ? "false"
                : c;

          return uNorm === cNorm;
        }

        // short_answer: 앞/뒤 공백만 제거 후, 대소문자/띄어쓰기는 엄격 비교
        // (확장: 출제자가 "||"로 여러 정답을 넣은 경우 중 하나만 일치해도 정답)
        const correctStr = String(correctRaw ?? "");
        const candidates = correctStr
          .split("||")
          .map((x) => x.replace(/\r\n/g, "\n").trim());
        const userNorm = normalizeForCompare(userAnswerText);

        return candidates.some((c) => userNorm === normalizeForCompare(c));
      })();

      if (isCorrect) score++;

      const storedUserAnswer = unanswered
        ? null
        : q.question_type === "multiple_choice" && normalizedUserIndex != null
          ? String(normalizedUserIndex)
          : userAnswerText;

      answerResults.push({
        questionId: q.id,
        userAnswer: storedUserAnswer,
        answerState: unanswered ? "unanswered" : "answered",
        isCorrect,
      });
    }

    const totalQuestions = questions.length;
    const isPerfect = totalQuestions > 0 && score === totalQuestions;

    const attemptResult = await sql<{ id: number }>`
      INSERT INTO quiz_attempts (user_id, post_id, score, total_questions, is_perfect, question_order)
      VALUES (${user.id}, ${quizId}, ${score}, ${totalQuestions}, ${isPerfect}, ${JSON.stringify(
        questionOrder,
      )})
      RETURNING id
    `;
    const attemptId = attemptResult[0].id;

    for (const r of answerResults) {
      await sql`
        INSERT INTO quiz_attempt_answers (attempt_id, question_id, user_answer, answer_state, is_correct)
        VALUES (${attemptId}, ${r.questionId}, ${r.userAnswer}, ${r.answerState}, ${r.isCorrect})
      `;
    }

    // progress update (기존 로직 유지)
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
      { status: 500 },
    );
  }
}
