// app/posts/[postId]/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import Link from "next/link";
import { redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import sanitizeHtml from "sanitize-html";

import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

import DashboardHeader from "@/components/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Difficulty = "easy" | "medium" | "hard" | "project" | null;
type PostType = "lesson" | "reference" | "quiz";

type ParamsShape = { postId?: string };
type SearchParamsShape = { from?: string };

type PostRow = {
  id: number;
  title: string;
  content: string | null;
  difficulty: Difficulty;
  course_id: number;
  course_name: string;
  course_slug: string;
  type: PostType;
};

type SetRow = { reference_post_id: number | null; quiz_post_id: number | null };
type RefRow = { id: number; title: string; content: string | null };

type AttachmentRow = {
  upload_id: number;
  label: string | null;
  order_index: number;
  filename: string;
  mime: string;
  size: number;
};

function looksLikeHtml(s: string) {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

function shouldShowDifficulty(type: PostType) {
  return type === "lesson";
}

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

async function fetchAttachments(postId: number) {
  return await sql<AttachmentRow>`
    SELECT
      pa.upload_id,
      pa.label,
      pa.order_index,
      u.filename,
      u.mime,
      u.size
    FROM public.post_attachments pa
    JOIN public.uploads u ON u.id = pa.upload_id
    WHERE pa.post_id = ${postId}
    ORDER BY pa.order_index ASC, pa.id ASC
  `;
}

function AttachmentsBlock({
  title,
  attachments,
}: {
  title: string;
  attachments: AttachmentRow[];
}) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="pt-2">
      <div className="text-xs text-muted-foreground mb-2">{title}</div>
      <div className="grid gap-2">
        {attachments.map((a) => (
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
                  {a.mime} {a.size ? `· ${formatBytes(a.size)}` : ""}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">다운로드</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default async function PostDetailPage({
  params,
  searchParams,
}: {
  params: ParamsShape | Promise<ParamsShape>;
  searchParams?: SearchParamsShape | Promise<SearchParamsShape>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const p: ParamsShape = params ? await params : {};
  const sp: SearchParamsShape = searchParams ? await searchParams : {};

  const postId = Number.parseInt(String(p?.postId ?? ""), 10);
  const fromId = Number.parseInt(String(sp?.from ?? ""), 10);

  if (!Number.isFinite(postId) || postId <= 0) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader user={user} />
        <main className="container mx-auto px-4 py-10">
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-destructive">
            잘못된 postId 입니다
          </div>
        </main>
      </div>
    );
  }

  const rows = await sql<PostRow>`
    SELECT
      p.id,
      p.title,
      p.content,
      p.difficulty,
      p.course_id,
      p.type,
      c.name as course_name,
      c.slug as course_slug
    FROM public.posts p
    JOIN public.courses c ON p.course_id = c.id
    WHERE p.id = ${postId}
    LIMIT 1
  `;
  const post = rows?.[0];
  if (!post) redirect("/posts");

  const setRows =
    post.type === "lesson"
      ? await sql<SetRow>`
          SELECT reference_post_id, quiz_post_id
          FROM public.lesson_sets
          WHERE lesson_id = ${post.id}
          LIMIT 1
        `
      : [];
  const set = setRows?.[0];
  const refId = post.type === "lesson" ? set?.reference_post_id ?? null : null;
  const quizId = post.type === "lesson" ? set?.quiz_post_id ?? null : null;

  const refPost =
    post.type === "lesson" && refId
      ? (
          await sql<RefRow>`
            SELECT id, title, content
            FROM public.posts
            WHERE id = ${refId} AND type = 'reference'
            LIMIT 1
          `
        )[0]
      : null;

  // ✅ 첨부파일: 상세페이지에서는 lesson + reference만 표시 (quiz는 quiz 페이지에서만)
  const lessonAttachments =
    post.type === "lesson" ? await fetchAttachments(post.id) : [];

  const referenceAttachments =
    post.type === "lesson" && refId ? await fetchAttachments(refId) : [];

  const currentAttachments =
    post.type !== "lesson" ? await fetchAttachments(post.id) : [];

  const raw = post.content ?? "";
  const isHtml = looksLikeHtml(raw);
  const safeHtml = isHtml
    ? sanitizeHtml(raw, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
        allowedAttributes: {
          a: ["href", "target", "rel"],
          img: ["src", "alt", "title", "width", "height"],
          "*": ["style"],
        },
        allowedSchemes: ["http", "https", "data"],
      })
    : "";

  const canGoBackToLesson = Number.isFinite(fromId) && fromId > 0;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" className="pl-0">
            <Link href={`/posts?course=${post.course_slug}`}>← 목록으로</Link>
          </Button>

          <Badge variant="secondary">{post.course_name}</Badge>

          {shouldShowDifficulty(post.type) && post.difficulty && (
            <Badge variant="outline">
              {post.difficulty === "hard" ? "project" : post.difficulty}
            </Badge>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{post.title}</CardTitle>
            <hr className="mt-3 mb-6 border-white/10" />
          </CardHeader>

          <CardContent className="space-y-6">
            {/* 본문 */}
            <div className="prose prose-invert max-w-none">
              {isHtml ? (
                <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{raw}</ReactMarkdown>
              )}
            </div>

            {/* reference/quiz 페이지를 직접 열었을 때(lesson이 아닐 때) 첨부 표시 */}
            {post.type !== "lesson" ? (
              <AttachmentsBlock
                title="첨부파일"
                attachments={currentAttachments}
              />
            ) : null}

            {/* ✅ 수업(lesson) 첨부파일 */}
            {post.type === "lesson" ? (
              <AttachmentsBlock
                title="수업 첨부파일"
                attachments={lessonAttachments}
              />
            ) : null}

            {/* 버튼 영역 */}
            {post.type === "lesson" ? (
              <div className="flex flex-wrap gap-3 pt-2">
                {canGoBackToLesson && (
                  <Button asChild variant="secondary">
                    <Link href={`/posts/${fromId}`}>수업내용으로</Link>
                  </Button>
                )}

                {user?.user_role === "ADMIN" && (
                  <Button asChild variant="secondary">
                    <Link href={`/posts/${postId}/edit-set`}>세트 수정</Link>
                  </Button>
                )}

                {quizId ? (
                  <Button asChild>
                    <Link href={`/quiz/${quizId}?from=${postId}`}>
                      문제풀이
                    </Link>
                  </Button>
                ) : (
                  <Button disabled>문제풀이</Button>
                )}
              </div>
            ) : null}

            {/* ✅ 인라인 참조자료 + 참조 첨부파일 */}
            {post.type === "lesson" && refPost ? (
              <div className="pt-2">
                <div className="text-xs text-muted-foreground mb-2">
                  참조자료
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="font-semibold mb-3">{refPost.title}</div>

                  <div className="prose prose-invert max-w-none">
                    {(() => {
                      const rawRef = refPost.content ?? "";
                      const isHtmlRef = looksLikeHtml(rawRef);
                      const safeRefHtml = isHtmlRef
                        ? sanitizeHtml(rawRef, {
                            allowedTags:
                              sanitizeHtml.defaults.allowedTags.concat(["img"]),
                            allowedAttributes: {
                              a: ["href", "target", "rel"],
                              img: ["src", "alt", "title", "width", "height"],
                              "*": ["style"],
                            },
                            allowedSchemes: ["http", "https", "data"],
                          })
                        : "";
                      return isHtmlRef ? (
                        <div
                          dangerouslySetInnerHTML={{ __html: safeRefHtml }}
                        />
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {rawRef}
                        </ReactMarkdown>
                      );
                    })()}
                  </div>

                  {/* ✅ 참조(reference) 첨부파일 */}
                  <div className="mt-6">
                    <AttachmentsBlock
                      title="참조자료 첨부파일"
                      attachments={referenceAttachments}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {/* 안내 문구 */}
            {post.type === "lesson" && (refId === null || quizId === null) ? (
              <div className="text-xs text-muted-foreground">
                {refId === null ? "참조자료가 없습니다. " : ""}
                {quizId === null ? "문제풀이가 없습니다." : ""}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
