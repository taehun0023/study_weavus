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

interface PageProps {
  params: Promise<{ quizId: string; attemptId: string }>;
  searchParams?: Promise<{ lessonId?: string }>;
}

function splitTitleFromHtml(html: string): { title: string; bodyHtml: string } {
  const v = String(html ?? "");

  const m = v.match(/^\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!m) {
    return { title: "", bodyHtml: v };
  }

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
  // 프로젝트에서 쓰는 네이밍이 다를 수 있어서 넓게 잡음
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

    // index -> 옵션 텍스트
    const n = Number(rawStr);
    if (opts.length > 0 && Number.isFinite(n) && n >= 0 && n < opts.length) {
      return String(opts[n]);
    }

    // 레거시(혹시 텍스트로 저장된 값이 있으면 그대로 노출)
    return rawStr;
  }

  // ✅ OX: 저장값이 0/1/true/false 등이어도 사람이 읽게 변환
  if (isTrueFalseType(questionType)) {
    const v = normalizeForCompare(rawStr);
    if (v === "TRUE" || v === "O" || v === "1") return "O";
    if (v === "FALSE" || v === "X" || v === "0") return "X";
    return rawStr;
  }

  // ✅ 주관식/코딩: 그대로
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

  // ✅ ADMIN: 특정 유저의 attempt도 조회 가능 (user_id 제한 제거)
  const attempts = await sql<{
    id: number;
    user_id: number;
    username: string;
    display_name: string | null;
    score: number;
    total_questions: number;
    is_perfect: boolean;
    question_order: number[];
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

  const answers = await sql<{
    question_id: number;
    user_answer: any;
    is_correct: boolean;
    question_text: any;
    question_type: string;
    options: any;
    correct_answer: any;
    explanation: any;
  }>`
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
  `;

  const order = Array.isArray(attempt.question_order)
    ? attempt.question_order
    : [];
  const sortedAnswers = order
    .map((qid) => answers.find((a) => a.question_id === qid))
    .filter(Boolean) as typeof answers;

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
                  {new Date(attempt.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">문제별 결과</h3>

          {sortedAnswers.map((a, idx) => {
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

            return (
              <Card
                key={a.question_id}
                className={`border ${
                  a.is_correct ? "border-green-500/30" : "border-red-500/30"
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
                    {a.is_correct ? (
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
                        a.is_correct
                          ? "border-green-500/20 bg-green-500/5"
                          : "border-red-500/20 bg-red-500/5"
                      }`}
                    >
                      <div className="text-xs text-muted-foreground mb-1">
                        내 답
                      </div>
                      <div className="whitespace-pre-wrap break-words text-sm">
                        {userDisplay || "(빈 값)"}
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

                  {!a.is_correct && !!a.explanation ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-xs text-muted-foreground mb-1">
                        해설
                      </div>
                      <div className="whitespace-pre-wrap break-words text-sm">
                        {String(a.explanation)}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}

          {sortedAnswers.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              결과가 없습니다.
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
