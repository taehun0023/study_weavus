// app/admin/quiz/[quizId]/result/[attemptId]/page.tsx
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import DashboardHeader from "@/components/dashboard-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import HighlightOnView from "@/components/highlight-on-view";
import { looksLikeHtmlPost as looksLikeHtml } from "@/lib/html/looksLikeHtml";
import { parseOptions } from "@/lib/quiz/parseOptions";
import { formatDateTime } from "@/lib/datetime";

interface PageProps {
  params: Promise<{ quizId: string; attemptId: string }>;
  searchParams?: Promise<{ lessonId?: string }>;
}

function splitTitleFromHtml(html: string): { title: string; bodyHtml: string } {
  const v = String(html ?? "");
  const m = v.match(/^\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!m) return { title: "", bodyHtml: v };

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

function normalizeForCompare(input: any) {
  return String(input ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function isChoiceType(questionType: string) {
  const t = String(questionType ?? "").toLowerCase();
  return (
    t === "multiple_choice" ||
    t === "objective" ||
    t === "mcq" ||
    t.includes("choice") ||
    t.includes("multiple")
  );
}

function isTrueFalseType(questionType: string) {
  const t = String(questionType ?? "").toLowerCase();
  return (
    t === "true_false" ||
    t === "ox" ||
    t.includes("true") ||
    t.includes("false")
  );
}

/**
 * ✅ attempt.question_order가
 * - number[] 로 올 수도 있고
 * - JSON string "[1,2,3]" 로 올 수도 있고
 * - postgres array "{1,2,3}" 로 올 수도 있음
 */
function parseOrder(value: any): number[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map(Number).filter((n) => Number.isFinite(n));
  }

  if (typeof value === "string") {
    // JSON string
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(Number).filter((n) => Number.isFinite(n));
      }
    } catch {}

    // postgres array string
    if (value.startsWith("{") && value.endsWith("}")) {
      return value
        .slice(1, -1)
        .split(",")
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n));
    }
  }

  return [];
}

function hasMeaningfulHtml(s: any) {
  if (typeof s !== "string") return false;
  if (/<img\b/i.test(s)) return true;

  const text = s
    .replace(/&nbsp;/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 0;
}

function displayAnswer(
  questionType: string,
  raw: any,
  optionsRaw: any,
): string {
  const rawStr = raw == null ? "" : String(raw);
  if (rawStr.trim() === "") return "";

  // ✅ 객관식: index 저장 → 텍스트로 변환해서 보여주기
  if (isChoiceType(questionType)) {
    const opts = parseOptions(optionsRaw);
    const n = Number(rawStr);
    if (opts.length > 0 && Number.isFinite(n) && n >= 0 && n < opts.length) {
      return String(opts[n]);
    }
    return rawStr; // 레거시 텍스트
  }

  // ✅ OX
  if (isTrueFalseType(questionType)) {
    const v = normalizeForCompare(rawStr);
    if (v === "TRUE" || v === "O" || v === "1") return "O";
    if (v === "FALSE" || v === "X" || v === "0") return "X";
    return rawStr;
  }

  // ✅ 주관식/코딩
  return rawStr;
}

export default async function AdminQuizAttemptResultPage({
  params,
  searchParams,
}: PageProps) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.user_role !== "ADMIN") notFound();

  const { quizId, attemptId } = await params;
  const sp = (await searchParams) ?? {};

  // ✅ attempt + quiz title
  const attempts = await sql<{
    id: number;
    user_id: number;
    username: string;
    display_name: string | null;
    score: number;
    total_questions: number;
    is_perfect: boolean;
    question_order: any;
    created_at: Date;
    quiz_title: string;
    course_slug: string;
  }>`
    SELECT
      qa.id,
      qa.user_id,
      u.username,
      u.display_name,
      qa.score,
      qa.total_questions,
      qa.is_perfect,
      qa.question_order,
      qa.created_at,
      p.title AS quiz_title,
      c.slug AS course_slug
    FROM quiz_attempts qa
    JOIN users u ON u.id = qa.user_id
    JOIN posts p ON qa.post_id = p.id
    JOIN courses c ON p.course_id = c.id
    WHERE qa.id = ${attemptId} AND qa.post_id = ${quizId}
  `;

  const attempt = attempts[0];
  if (!attempt) notFound();

  /**
   * ✅ B안 기준:
   * - "현재 활성 문제(is_deleted=false)"만 출력 대상
   * - quiz_questions를 기준으로 하고,
   * - attempt 답안을 LEFT JOIN하여 (미제출)도 표시
   */
  const rows = await sql<{
    question_id: number;
    question_text: any;
    question_type: string;
    options: any;
    correct_answer: any;
    explanation: any;
    order_index: number;

    user_answer: any;
    is_correct: boolean | null;
    answer_id: number | null;
  }>`
    SELECT
      qq.id AS question_id,
      qq.question_text,
      qq.question_type,
      qq.options,
      qq.correct_answer,
      qq.explanation,
      qq.order_index,

      qaa.user_answer,
      qaa.is_correct,
      qaa.id AS answer_id
    FROM quiz_questions qq
    LEFT JOIN quiz_attempt_answers qaa
      ON qaa.question_id = qq.id
     AND qaa.attempt_id = ${attemptId}
    WHERE qq.post_id = ${quizId}
      AND qq.is_deleted = FALSE
    ORDER BY qq.order_index ASC, qq.id ASC
  `;

  // 정렬 우선순위:
  // 1) attempt.question_order가 있으면 그 순서를 최대한 반영
  // 2) 매칭이 일부/0개면 rows(현재 문제 순서)로 fallback
  const order = parseOrder(attempt.question_order);

  const byId = new Map<number, (typeof rows)[number]>();
  for (const r of rows) byId.set(r.question_id, r);

  const orderSet = new Set(order);
  const ordered = order
    .map((qid) => byId.get(qid))
    .filter(Boolean) as typeof rows;

  const remainder = rows.filter((r) => !orderSet.has(r.question_id));

  const sortedRows =
    order.length > 0
      ? ordered.length > 0
        ? [...ordered, ...remainder]
        : rows
      : rows;

  // 점수 % (표시는 attempt 저장값 기준: B안에서는 "재채점 후" 최신 값이어야 함)
  const scorePercent =
    attempt.total_questions > 0
      ? Math.round((attempt.score / attempt.total_questions) * 100)
      : 0;

  const backHref = sp.lessonId ? `/posts/${sp.lessonId}` : "/";

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={me} />

      <main className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link href={backHref}>
            <Button variant="ghost">목록으로</Button>
          </Link>
        </div>

        <Card
          className={`border-2 ${
            attempt.is_perfect
              ? "border-green-500/50 bg-green-500/5"
              : "border-border"
          }`}
        >
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                제출자: {attempt.display_name ?? attempt.username} (
                {attempt.username})
              </div>
              <div className="text-xl font-semibold">{attempt.quiz_title}</div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <div className="text-3xl font-bold">
                  {attempt.score} / {attempt.total_questions}
                </div>
                <div className="text-muted-foreground">{scorePercent}점</div>

                {attempt.is_perfect ? (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    만점(합격)
                  </Badge>
                ) : (
                  <Badge variant="secondary">채점 완료</Badge>
                )}

                <div className="ml-auto text-xs text-muted-foreground">
                  {formatDateTime(attempt.created_at)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">문제별 결과</h3>

          {sortedRows.map((a, idx) => {
            const rawQ = String(a.question_text ?? "");
            const isHtml = looksLikeHtml(rawQ);
            const parts = isHtml
              ? splitTitleFromHtml(rawQ)
              : { title: rawQ, bodyHtml: "" };

            const userDisplay = displayAnswer(
              a.question_type,
              a.user_answer,
              a.options,
            );
            const correctDisplay = displayAnswer(
              a.question_type,
              a.correct_answer,
              a.options,
            );

            const isSubmitted = a.answer_id != null;
            const isCorrect = a.is_correct === true;

            return (
              <Card
                key={a.question_id}
                className={`border ${
                  !isSubmitted
                    ? "border-white/10"
                    : isCorrect
                      ? "border-green-500/30"
                      : "border-red-500/30"
                }`}
              >
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-muted-foreground">
                        Q{idx + 1}
                      </div>
                      <div className="font-semibold break-words">
                        {parts.title}
                      </div>
                    </div>

                    {!isSubmitted ? (
                      <Badge variant="secondary">미제출</Badge>
                    ) : isCorrect ? (
                      <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                        정답
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                        오답
                      </Badge>
                    )}
                  </div>

                  {parts.bodyHtml ? (
                    <HighlightOnView
                      selector={`admin-attempt-q-${a.question_id}`}
                    >
                      <div
                        className={`prose prose-invert max-w-none admin-attempt-q-${a.question_id}`}
                        dangerouslySetInnerHTML={{ __html: parts.bodyHtml }}
                      />
                    </HighlightOnView>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div
                      className={`rounded-xl border p-3 ${
                        !isSubmitted
                          ? "border-white/10 bg-white/5"
                          : isCorrect
                            ? "border-green-500/20 bg-green-500/5"
                            : "border-red-500/20 bg-red-500/5"
                      }`}
                    >
                      <div className="text-xs text-muted-foreground mb-1">
                        내 답
                      </div>
                      <div className="whitespace-pre-wrap break-words text-sm">
                        {isSubmitted ? userDisplay || "(빈 값)" : "(미제출)"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
                      <div className="text-xs text-muted-foreground mb-1">
                        정답
                      </div>
                      <div className="whitespace-pre-wrap break-words text-sm">
                        {correctDisplay || "-"}
                      </div>
                    </div>
                  </div>

                  {!isCorrect && hasMeaningfulHtml(a.explanation) ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-xs text-muted-foreground mb-1">
                        해설
                      </div>

                      {looksLikeHtml(String(a.explanation)) ? (
                        <HighlightOnView
                          selector={`admin-attempt-exp-${a.question_id}`}
                        >
                          <div
                            className={`prose prose-invert max-w-none admin-attempt-exp-${a.question_id}`}
                            dangerouslySetInnerHTML={{
                              __html: String(a.explanation),
                            }}
                          />
                        </HighlightOnView>
                      ) : (
                        <div className="whitespace-pre-wrap break-words text-sm">
                          {String(a.explanation)}
                        </div>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}

          {sortedRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              결과가 없습니다.
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
