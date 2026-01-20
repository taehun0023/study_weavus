import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import DashboardHeader from "@/components/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, ArrowLeft, Trophy } from "lucide-react";
import { AttemptHistory } from "@/components/attempt-history";
import HighlightOnView from "@/components/highlight-on-view";
import CopyInlineButton from "@/components/quiz/copy-inline-button";
import RetryWithPrefillButton from "@/components/quiz/retry-with-prefill-button";

interface ResultPageProps {
  params: Promise<{
    quizId: string;
    attemptId: string;
  }>;
}

function looksLikeHtml(s: any): boolean {
  const v = String(s ?? "");
  return /<\w[\s\S]*>/.test(v);
}

// Quill 기본: 첫 줄이 <p>... (질문) 형태인 경우가 많아서
// 결과 화면에서 Qn. 제목 라인으로 빼고, 본문은 아래에 렌더.
function splitTitleFromHtml(html: string): { title: string; bodyHtml: string } {
  const v = String(html ?? "");

  const m = v.match(/^\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!m) {
    return { title: "", bodyHtml: v };
  }

  // HTML 태그 제거(간단 버전)
  const title = m[1]
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();

  const bodyHtml = v.slice(m[0].length).trim();
  return { title, bodyHtml };
}

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

function isBlank(v: any): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

export default async function ResultPage({ params }: ResultPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { quizId, attemptId } = await params;

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
  `;

  const attempt = attempts[0];

  if (!attempt) {
    notFound();
  }

  // Get answers with questions in the order they were presented
  const questionOrder = attempt.question_order as number[];

  // ✅ answer_state 포함해서 조회 (UI는 그대로, 데이터만 추가)
  const allAnswers = await sql`
    SELECT 
      qaa.question_id,
      qaa.user_answer,
      qaa.answer_state,
      qaa.is_correct,
      qq.question_text,
      qq.question_type,
      qq.options,
      qq.correct_answer,
      qq.explanation
    FROM quiz_attempt_answers qaa
    JOIN quiz_questions qq ON qaa.question_id = qq.id
    WHERE qaa.attempt_id = ${attemptId}
  `;

  /**
   * ✅ 다시풀기(prefill) 생성 로직 (UI 변경 없음)
   * - 미작성(unanswered) 또는 빈 문자열은 절대 prefill에 넣지 않음
   * - 객관식에서 Number("") === 0 되는 버그 차단
   * - 객관식은 가능한 index로 저장(안정적)
   */
  const answersForPrefill: Record<string, any> = {};
  for (const a of allAnswers) {
    const qid = String(a.question_id);

    const state = String((a as any).answer_state ?? "").toLowerCase();
    const seeRaw = a.user_answer;

    // ✅ 미작성은 prefill 제외
    if (state === "unanswered") continue;
    if (seeRaw == null) continue;

    const see = String(seeRaw);
    if (see.trim() === "") continue;

    if (a.question_type === "multiple_choice") {
      const opts = parseOptions(a.options);

      // 1) user_answer가 숫자(또는 숫자 문자열)로 저장된 경우: "" 방지 + 범위 체크
      const n = see.trim() === "" ? NaN : Number(see);
      if (opts.length > 0 && Number.isFinite(n) && n >= 0 && n < opts.length) {
        answersForPrefill[qid] = n;
        continue;
      }

      // 2) 옵션 텍스트로 저장된 경우: 텍스트 -> index로 변환
      if (opts.length > 0) {
        const idx = opts.findIndex((x) => String(x) === see);
        if (idx >= 0) {
          answersForPrefill[qid] = idx;
          continue;
        }
      }

      // 3) 그 외는 그냥 텍스트로(최후 방어)
      answersForPrefill[qid] = see;
    } else {
      answersForPrefill[qid] = see;
    }
  }

  // Sort answers by the question_order from the attempt
  const sortedAnswers = questionOrder
    .map((qId) => allAnswers.find((a) => a.question_id === qId))
    .filter(Boolean);

  const scorePercent = Math.round(
    (attempt.score / attempt.total_questions) * 100,
  );

  function looksLikeHtml2(s: any) {
    const v = String(s ?? "").trim();
    return v.startsWith("<") && v.includes(">");
  }

  function extractTitleAndBody(text: string) {
    const raw = String(text ?? "");
    if (!looksLikeHtml2(raw)) {
      return { title: raw, bodyHtml: "" };
    }

    // 첫 <p>...</p>를 제목으로 사용
    const m = raw.match(/^\s*<p[^>]*>([\s\S]*?)<\/p>/i);
    if (!m) {
      return { title: "", bodyHtml: raw };
    }

    const titleHtml = m[1];
    const title = titleHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();

    const bodyHtml = raw.replace(m[0], "").trim();
    return { title, bodyHtml };
  }

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
        <Card
          className={`border-2 ${attempt.is_perfect ? "border-green-500/50 bg-green-500/5" : "border-border"}`}
        >
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              {attempt.is_perfect && (
                <div className="flex justify-center">
                  <div className="p-3 rounded-full bg-green-500/20">
                    <Trophy className="h-8 w-8 text-green-500" />
                  </div>
                </div>
              )}
              <h2 className="text-2xl font-bold text-foreground">
                {attempt.quiz_title}
              </h2>
              <div className="text-5xl font-bold text-foreground">
                {attempt.score} / {attempt.total_questions}
              </div>
              <div className="text-xl text-muted-foreground">
                {scorePercent}점
              </div>
              {attempt.is_perfect && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-lg px-4 py-1">
                  만점 달성! 완료 처리됨
                </Badge>
              )}
              <div className="pt-4 flex justify-center">
                <RetryWithPrefillButton
                  quizId={Number(quizId)}
                  answers={answersForPrefill}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Question Results */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">문제별 결과</h3>
          {sortedAnswers.map((answer: any, index: number) => {
            const q = extractTitleAndBody(answer.question_text);
            const hasBody = !!q.bodyHtml;
            const bodySelector = `result-prose-${answer.question_id}`;

            const state = String(answer.answer_state ?? "").toLowerCase();
            const myAnswerText = String(answer.user_answer ?? "");
            const correctText = String(answer.correct_answer ?? "");

            const isUnanswered =
              state === "unanswered" || isBlank(myAnswerText);

            return (
              <Card
                key={answer.question_id}
                className={`border-2 ${
                  answer.is_correct
                    ? "border-green-500/35 bg-green-500/5"
                    : "border-red-500/35 bg-red-500/5"
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base text-foreground flex items-center gap-2">
                      <span className="text-muted-foreground">
                        Q{index + 1}.
                      </span>
                      {q.title ||
                        (looksLikeHtml(answer.question_text)
                          ? ""
                          : String(answer.question_text ?? ""))}
                    </CardTitle>

                    {answer.is_correct ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        정답
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        <XCircle className="h-3 w-3 mr-1" />
                        {isUnanswered ? "미작성" : "오답"}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {hasBody ? (
                    <>
                      <HighlightOnView selector={`.${bodySelector}`} />
                      <div
                        className={`${bodySelector} prose prose-invert max-w-none`}
                        dangerouslySetInnerHTML={{ __html: q.bodyHtml }}
                      />
                    </>
                  ) : null}

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div
                      className={`p-3 rounded-lg border ${
                        answer.is_correct
                          ? "bg-green-500/10 border-green-500/20"
                          : "bg-red-500/10 border-red-500/20"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-muted-foreground">내 답</p>
                        {/* 미작성은 복사 버튼 안 보여줘도 UI 거의 동일 */}
                        {isUnanswered ? null : (
                          <CopyInlineButton
                            className="h-7 px-2"
                            text={myAnswerText || ""}
                          />
                        )}
                      </div>
                      <pre className="whitespace-pre-wrap text-sm text-foreground font-mono">
                        {isUnanswered ? "(미작성)" : myAnswerText}
                      </pre>
                    </div>

                    {!answer.is_correct ? (
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-muted-foreground">정답</p>
                          <CopyInlineButton
                            className="h-7 px-2"
                            text={correctText || ""}
                          />
                        </div>
                        <pre className="whitespace-pre-wrap text-sm text-foreground font-mono">
                          {correctText}
                        </pre>
                      </div>
                    ) : null}
                  </div>

                  {answer.explanation && (
                    <div className="p-3 rounded-lg bg-card border border-border">
                      <p className="text-sm text-muted-foreground mb-1">해설</p>
                      {looksLikeHtml(answer.explanation) ? (
                        <>
                          <HighlightOnView selector={`.${bodySelector}-exp`} />
                          <div
                            className={`${bodySelector}-exp prose prose-invert max-w-none`}
                            dangerouslySetInnerHTML={{
                              __html: String(answer.explanation),
                            }}
                          />
                        </>
                      ) : (
                        <p className="text-foreground whitespace-pre-wrap">
                          {answer.explanation}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Attempt History */}
        <AttemptHistory
          quizId={Number(quizId)}
          userId={user.id}
          currentAttemptId={Number(attemptId)}
        />
      </main>
    </div>
  );
}
