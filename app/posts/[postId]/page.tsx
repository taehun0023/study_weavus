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
import HighlightOnView from "@/components/highlight-on-view";
import PostAdminActions from "@/components/post-admin-actions";
import CodeBlockEnhancer from "@/components/codeblock-enhancer";
import { looksLikeHtmlPost as looksLikeHtml } from "@/lib/html/looksLikeHtml";

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

function stripLeadingEmptyBlocks(html: string) {
  return html.replace(
    /^(?:\s*<(p|div)>(?:\s|&nbsp;|<br\s*\/?>)*<\/\1>)+/gi,
    "",
  );
}

function sanitizeQuillHtml(raw: string) {
  const cleaned = stripLeadingEmptyBlocks(raw);

  return sanitizeHtml(cleaned, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "pre",
      "code",
      "span",
      "ol",
      "ul",
      "li",
      "h1",
      "h2",
      "h3",
      "hr",
    ]),
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      pre: ["class", "data-language"],
      code: ["class", "data-language"],
      li: ["class", "data-list"],
      span: ["class"],
      "*": ["style", "class", "data-list", "data-language"],
    },
    allowedSchemes: ["http", "https", "data"],
  });
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

      <div className="space-y-2">
        {attachments.map((a) => (
          <a
            key={a.upload_id}
            href={`/api/upload/${a.upload_id}`}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-card/40 px-3 py-2 text-sm hover:bg-accent transition"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">
                {a.label?.trim() ? a.label : a.filename}
              </div>

              {a.size ? (
                <div className="text-xs text-muted-foreground">
                  {formatBytes(a.size)}
                </div>
              ) : null}
            </div>

            <div className="shrink-0 text-xs text-muted-foreground">
              다운로드
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
  const refId =
    post.type === "lesson" ? (set?.reference_post_id ?? null) : null;
  const quizId = post.type === "lesson" ? (set?.quiz_post_id ?? null) : null;

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

  const lessonAttachments =
    post.type === "lesson" ? await fetchAttachments(post.id) : [];

  const referenceAttachments =
    post.type === "lesson" && refId ? await fetchAttachments(refId) : [];

  const currentAttachments =
    post.type !== "lesson" ? await fetchAttachments(post.id) : [];

  const raw = post.content ?? "";
  const isHtml = looksLikeHtml(raw);
  const safeHtml = isHtml ? sanitizeQuillHtml(raw) : "";

  const canGoBackToLesson = Number.isFinite(fromId) && fromId > 0;

  function difficultyBadgeClass(difficulty: string) {
    switch (difficulty) {
      case "easy":
        return "border-emerald-500/40 text-emerald-300 bg-emerald-500/10";
      case "medium":
        return "border-amber-500/40 text-amber-300 bg-amber-500/10";
      case "hard":
        return "border-rose-500/40 text-rose-300 bg-rose-500/10";
      case "project":
        return "border-violet-500/40 text-violet-300 bg-violet-500/10";
      default:
        return "border-border text-foreground bg-transparent";
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb + actions bar */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="-ml-2 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Link href={`/posts?course=${post.course_slug}`}>← 목록</Link>
            </Button>

            <span className="rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
              {post.course_name}
            </span>

            {shouldShowDifficulty(post.type) && post.difficulty && (
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-md ${difficultyBadgeClass(
                  post.difficulty === "hard" ? "project" : post.difficulty,
                )}`}
              >
                {post.difficulty === "hard" ? "project" : post.difficulty}
              </span>
            )}
          </div>

          {user?.user_role === "ADMIN" && post.type === "lesson" ? (
            <div className="shrink-0">
              <PostAdminActions
                postId={post.id}
                postType={post.type}
                setEditHref={`/posts/${post.id}/edit-set`}
                afterDeleteHref={`/posts?course=${post.course_slug}`}
                size="sm"
              />
            </div>
          ) : null}
        </div>

        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-2xl tracking-tight">{post.title}</CardTitle>
            <hr className="mb-0 mt-3 border-border/40" />

            {post.type === "lesson" ? (
              <div className="mt-4">
                <AttachmentsBlock
                  title="수업 첨부파일"
                  attachments={lessonAttachments}
                />
              </div>
            ) : null}
          </CardHeader>

          <CardContent className="pt-4">
            <div className="tistory-prose post-content study-richtext">
              {isHtml ? (
                <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{raw}</ReactMarkdown>
              )}
            </div>

            <div className="mt-4">
              <HighlightOnView selector=".post-content" />
              <CodeBlockEnhancer selector=".post-content" />
            </div>

            {post.type !== "lesson" ? (
              <div className="mt-5">
                <AttachmentsBlock
                  title="첨부파일"
                  attachments={currentAttachments}
                />
              </div>
            ) : null}

            {post.type === "lesson" ? (
              <div className="mt-5 flex items-center gap-3">
                {canGoBackToLesson ? (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/posts/${fromId}`}>← 수업내용으로</Link>
                  </Button>
                ) : null}
              </div>
            ) : null}

            {post.type === "lesson" ? (
              <div className="mt-8">
                <div className="mx-auto max-w-[760px]">
                  <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    참조자료
                  </div>

                  {refPost ? (
                    <div className="rounded-xl border border-border/60 bg-card/50 p-5">
                      <div className="mb-4 font-semibold text-foreground">{refPost.title}</div>

                      <div className="post-content tistory-prose study-richtext">
                        {(() => {
                          const rawRef = refPost.content ?? "";
                          const isHtmlRef = looksLikeHtml(rawRef);
                          const safeRefHtml = isHtmlRef
                            ? sanitizeQuillHtml(rawRef)
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

                      <div className="mt-6">
                        <AttachmentsBlock
                          title="참조자료 첨부파일"
                          attachments={referenceAttachments}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                      참조자료가 없습니다.
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    {quizId ? (
                      <Button asChild>
                        <Link href={`/quiz/${quizId}?from=${postId}`}>
                          문제풀기 →
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        문제풀이가 없습니다.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
