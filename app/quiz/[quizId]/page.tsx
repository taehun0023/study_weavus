// app/quiz/[quizId]/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

import DashboardHeader from "@/components/dashboard-header";
import QuizRenderer from "@/components/quiz/quiz-renderer";
import FileSubmitPanel from "@/components/submissions/file-submit-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Params = { quizId?: string };
type SearchParams = { from?: string };

type AttachmentRow = {
  upload_id: number;
  label: string | null;
  order_index: number;
  filename: string;
  mime: string;
  size: number | null;
};

function formatBytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default async function QuizPage({
  params,
  searchParams,
}: {
  params: Params | Promise<Params>;
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const p = params ? await params : {};
  const sp = searchParams ? await searchParams : {};

  const quizId = Number.parseInt(String(p.quizId ?? ""), 10);
  const fromLessonId = Number.parseInt(String(sp.from ?? ""), 10);

  if (!Number.isFinite(quizId) || quizId <= 0) redirect("/posts");

  const quizPost = await pool.query(
    `SELECT id, title, content FROM public.posts WHERE id=$1 AND type='quiz' LIMIT 1`,
    [quizId]
  );
  if (quizPost.rows.length === 0) redirect("/posts");

  // ✅ NEW: 문제풀이(quiz) 첨부파일 조회 (상단 표시용)
  const attRes = await pool.query<AttachmentRow>(
    `
    SELECT
      pa.upload_id,
      pa.label,
      pa.order_index,
      u.filename,
      u.mime,
      u.size
    FROM public.post_attachments pa
    JOIN public.uploads u ON u.id = pa.upload_id
    WHERE pa.post_id = $1
    ORDER BY pa.order_index ASC, pa.id ASC
    `,
    [quizId]
  );
  const quizAttachments = attRes.rows ?? [];

  // quiz ↔ lesson 연결
  const setRow = await pool.query(
    `SELECT lesson_id FROM public.lesson_sets WHERE quiz_post_id=$1 LIMIT 1`,
    [quizId]
  );
  const lessonId = setRow.rows[0]?.lesson_id ?? null;

  const qs = await pool.query(
    `
    SELECT id, question_text, question_type, options
    FROM public.quiz_questions
    WHERE post_id = $1
    ORDER BY order_index ASC
    `,
    [quizId]
  );

  const questions = qs.rows.map((r) => ({
    id: String(r.id),
    questionText: r.question_text,
    questionType: r.question_type,
    options: Array.isArray(r.options) ? r.options : r.options ? r.options : [],
  }));

  const backHref =
    Number.isFinite(fromLessonId) && fromLessonId > 0
      ? `/posts/${fromLessonId}`
      : "/posts";

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost" className="pl-0">
            <Link href={backHref}>
              ← {backHref.startsWith("/posts/") ? "수업으로" : "목록으로"}
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{quizPost.rows[0].title}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* ✅ NEW: 문제풀이 첨부파일 (페이지 상단) */}
            {quizAttachments.length > 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-muted-foreground mb-3">
                  문제풀이 첨부파일
                </div>

                <div className="grid gap-2">
                  {quizAttachments.map((a) => (
                    <a
                      key={a.upload_id}
                      href={`/api/upload/${a.upload_id}`}
                      className="rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {a.label?.trim() ? a.label : a.filename}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {a.mime}
                            {a.size ? ` · ${formatBytes(a.size)}` : ""}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          다운로드
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {/* 퀴즈 풀이 */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <QuizRenderer quizId={quizId} questions={questions as any} />
            </div>

            {/* 파일 제출 */}
            {lessonId ? (
              <FileSubmitPanel lessonId={lessonId} attemptId={null} />
            ) : (
              <div className="text-sm text-muted-foreground">
                이 퀴즈가 특정 수업과 연결되어 있지 않아 파일 제출을 사용할 수
                없습니다.
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
