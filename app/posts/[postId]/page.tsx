// app/posts/[postId]/page.tsx
export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

import Link from "next/link"
import { redirect } from "next/navigation"
import DOMPurify from "isomorphic-dompurify"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { getCurrentUser } from "@/lib/auth"
import { sql } from "@/lib/db"

import DashboardHeader from "@/components/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type PostType = "lesson" | "quiz" | "reference"
type Difficulty = "easy" | "medium" | "hard" | "project" | null

type PostRow = {
  id: number
  course_id: number
  title: string
  type: PostType
  difficulty: Difficulty
  content: string | null
  course_name: string
  course_slug: string
  author_id?: number | null
}

type RelatedRow = { id: number }

type ParamsShape = { postId?: string }

function typeLabel(t: PostType) {
  if (t === "lesson") return "수업내용"
  if (t === "quiz") return "문제풀이"
  return "참고자료"
}

function normalizedDifficulty(d: Difficulty): "easy" | "medium" | "project" | null {
  if (!d) return null
  if (d === "hard" || d === "project") return "project"
  if (d === "easy") return "easy"
  if (d === "medium") return "medium"
  return null
}

function difficultyLabel(d: Difficulty) {
  return normalizedDifficulty(d) ?? ""
}

function difficultyClass(d: Difficulty): string {
  const nd = normalizedDifficulty(d)
  if (nd === "easy") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
  if (nd === "medium") return "bg-yellow-500/15 text-yellow-200 border-yellow-500/30"
  if (nd === "project") return "bg-sky-500/15 text-sky-200 border-sky-500/30"
  return ""
}

function looksLikeHtml(s: string) {
  // tiptap은 보통 <p>, <h1>, <img> 같은 태그가 포함됨
  return /<\/?[a-z][\s\S]*>/i.test(s)
}

export default async function PostDetailPage({
  params,
}: {
  params: ParamsShape | Promise<ParamsShape>
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const p: ParamsShape = (params ? await params : {}) ?? {}
  const postId = Number.parseInt(String(p.postId ?? ""), 10)

  if (!Number.isFinite(postId) || postId <= 0) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader user={user} />
        <main className="container mx-auto px-4 py-10">
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-destructive">
            잘못된 postId 입니다!
          </div>
        </main>
      </div>
    )
  }

  const rows = await sql<PostRow>`
    SELECT
      p.id,
      p.course_id,
      p.title,
      p.type,
      p.difficulty,
      p.content,
      c.name as course_name,
      c.slug as course_slug
    FROM public.posts p
    JOIN public.courses c ON p.course_id = c.id
    WHERE p.id = ${postId}
    LIMIT 1
  `
  const post = rows?.[0]

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader user={user} />
        <main className="container mx-auto px-4 py-10">
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            게시글을 찾을 수 없습니다.
          </div>
        </main>
      </div>
    )
  }

  // DB에 "\\n" 형태로 들어간 경우 보정
  const raw = post.content ?? ""
  const fixed = raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw

  // tiptap(HTML) / 기존 markdown 모두 렌더링 지원
  const isHtml = looksLikeHtml(fixed)
  const safeHtml = isHtml ? DOMPurify.sanitize(fixed) : ""

  // 같은 과목(course)에서 최신 reference/quiz 버튼 제공
  const [ref] = await sql<RelatedRow>`
    SELECT id
    FROM public.posts
    WHERE course_id = ${post.course_id}
      AND type = 'reference'
    ORDER BY id DESC
    LIMIT 1
  `
  const [quiz] = await sql<RelatedRow>`
    SELECT id
    FROM public.posts
    WHERE course_id = ${post.course_id}
      AND type = 'quiz'
    ORDER BY id DESC
    LIMIT 1
  `
  const refId = ref?.id ?? null
  const quizId = quiz?.id ?? null

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="pl-0">
            <Link href={`/posts?course=${post.course_slug}`}>← 목록으로</Link>
          </Button>

          <Badge variant="outline">{typeLabel(post.type)}</Badge>
          <Badge variant="secondary">{post.course_name}</Badge>

          {post.difficulty && (
            <Badge variant="outline" className={difficultyClass(post.difficulty)}>
              {difficultyLabel(post.difficulty)}
            </Badge>
          )}

          <div className="flex-1" />
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-2xl">{post.title}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {fixed.trim().length === 0 ? (
              <div className="text-sm text-muted-foreground">내용이 없습니다.</div>
            ) : (
              <div className="prose prose-invert max-w-none">
                {isHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{fixed}</ReactMarkdown>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="secondary" disabled={!refId}>
                <Link href={refId ? `/posts/${refId}` : "#"}>참고자료 보기</Link>
              </Button>

              <Button asChild disabled={!quizId}>
                <Link href={quizId ? `/posts/${quizId}` : "#"}>문제풀이 하러가기</Link>
              </Button>
            </div>

            {(!refId || !quizId) && (
              <div className="text-xs text-muted-foreground">
                {refId ? "" : "참고자료가 없습니다. "}
                {quizId ? "" : "문제풀이가 없습니다."}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
