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

      {/* ✅ main 간격(space-y-6) 제거: 여기서 큰 간격이 쌓였음 */}
      <main className="container mx-auto px-4 py-8">
        {/* ✅ 상단 영역: 좌측(목록/배지) + 우측(관리자 액션) */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" className="pl-0">
              <Link href={`/posts?course=${post.course_slug}`}>← 목록으로</Link>
            </Button>

            <Badge variant="secondary">{post.course_name}</Badge>

            {shouldShowDifficulty(post.type) && post.difficulty && (
              <Badge
                variant="outline"
                className={difficultyBadgeClass(
                  post.difficulty === "hard" ? "project" : post.difficulty,
                )}
              >
                {post.difficulty === "hard" ? "project" : post.difficulty}
              </Badge>
            )}
          </div>

          {/* 관리자: 수업내용 페이지 우측 상단에 수정/삭제 노출 */}
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-2xl">{post.title}</CardTitle>
            {/* ✅ 여기 마진이 “보라색” 주범이었음 */}
            <hr className="mt-3 mb-0 border-white/10" />
          </CardHeader>

          {/* ✅ CardContent의 space-y-6 제거 → 필요한 곳만 mt로 제어 */}
          <CardContent className="pt-4">
            <div className="prose prose-invert max-w-none">
              {isHtml ? (
                <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{raw}</ReactMarkdown>
              )}
            </div>

            <div className="mt-4">
              <HighlightOnView selector=".prose" />
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
              <div className="mt-5">
                <AttachmentsBlock
                  title="수업 첨부파일"
                  attachments={lessonAttachments}
                />
              </div>
            ) : null}

            {post.type === "lesson" ? (
              <div className="flex flex-wrap gap-3 mt-5">
                {canGoBackToLesson && (
                  <Button asChild variant="secondary">
                    <Link href={`/posts/${fromId}`}>수업내용으로</Link>
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

            {post.type === "lesson" && refPost ? (
              <div className="mt-6">
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
              </div>
            ) : null}

            {post.type === "lesson" && (refId === null || quizId === null) ? (
              <div className="text-xs text-muted-foreground mt-4">
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
