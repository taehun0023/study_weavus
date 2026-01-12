// app/posts/[postId]/page.tsx
import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { sql } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

export const runtime = "nodejs"

type PostRow = {
  id: number
  title: string
  content: string
  type: "lesson" | "quiz" | "reference"
  difficulty: "easy" | "medium" | "hard" | null
  course_id: number
  course_name: string
  course_slug: string
}

type RelatedPost = {
  id: number
  title: string
}

function normalizeTitleForMatch(title: string) {
  return title
    .replace(/\s*(수업내용|강의|이론|문법|개념|정리)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

async function findRelated(courseId: number, baseTitle: string, type: "quiz" | "reference") {
  // 1차: 제목 유사
  const r1 = await sql<RelatedPost>`
    SELECT id, title
    FROM public.posts
    WHERE course_id = ${courseId}
      AND type = ${type}
      AND title ILIKE ${"%" + baseTitle + "%"}
    ORDER BY id
    LIMIT 1
  `
  if (r1[0]) return r1[0]

  // 2차: 같은 과목 내 첫 번째
  const r2 = await sql<RelatedPost>`
    SELECT id, title
    FROM public.posts
    WHERE course_id = ${courseId}
      AND type = ${type}
    ORDER BY id
    LIMIT 1
  `
  return r2[0] ?? null
}

export default async function PostDetailPage({
  params,
}: {
  params: { postId: string }
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const postId = Number(params.postId)
  if (!Number.isFinite(postId)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Alert variant="destructive" className="max-w-md w-full">
          <AlertDescription>잘못된 postId 입니다: {params.postId}</AlertDescription>
        </Alert>
      </div>
    )
  }

  try {
    const rows = await sql<PostRow>`
      SELECT 
        p.id,
        p.title,
        p.content,
        p.type,
        p.difficulty,
        p.course_id,
        c.name as course_name,
        c.slug as course_slug
      FROM public.posts p
      JOIN public.courses c ON c.id = p.course_id
      WHERE p.id = ${postId}
      LIMIT 1
    `

    const post = rows[0]

    // ✅ 튕기지 말고 화면에 표시(원인 확정)
    if (!post) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="max-w-md w-full space-y-4 text-center">
            <h1 className="text-2xl font-bold">게시글을 찾을 수 없음</h1>
            <p className="text-muted-foreground">
              DB에 postId={params.postId} 레코드가 없습니다.
            </p>
            <Button asChild variant="outline">
              <Link href="/posts">목록으로</Link>
            </Button>
          </div>
        </div>
      )
    }

    // ✅ 수업내용이면 세트(참고자료/문제풀이) 찾기
    let relatedRef: RelatedPost | null = null
    let relatedQuiz: RelatedPost | null = null
    if (post.type === "lesson") {
      const base = normalizeTitleForMatch(post.title)
      relatedRef = await findRelated(post.course_id, base, "reference")
      relatedQuiz = await findRelated(post.course_id, base, "quiz")
    }

    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="mb-6 flex items-center gap-3">
            <Button asChild variant="ghost">
              <Link href={`/posts?course=${encodeURIComponent(post.course_slug)}`}>
                ← 목록으로
              </Link>
            </Button>

            <Badge variant="secondary">{post.course_name}</Badge>
            <Badge variant="outline">
              {post.type === "lesson"
                ? "수업내용"
                : post.type === "reference"
                ? "참고자료"
                : "문제풀이"}
            </Badge>
          </div>

          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                {post.difficulty && <Badge variant="secondary">{post.difficulty}</Badge>}
              </div>
              <CardTitle className="text-2xl">{post.title}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="whitespace-pre-wrap leading-7">{post.content}</div>

              {/* ✅ 수업내용이면 “참고자료 + 문제풀이” 한 세트 */}
              {post.type === "lesson" && (
                <div className="space-y-3 pt-2">
                  <div className="text-sm text-muted-foreground">
                    수업내용 → 참고자료 → 문제풀이 순서로 학습하세요.
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    {relatedRef ? (
                      <Button asChild variant="secondary" className="w-full sm:w-auto">
                        <Link href={`/posts/${relatedRef.id}`}>참고자료 보기</Link>
                      </Button>
                    ) : (
                      <Button disabled variant="secondary" className="w-full sm:w-auto">
                        참고자료 없음
                      </Button>
                    )}

                    {relatedQuiz ? (
                      <Button asChild className="w-full sm:w-auto">
                        <Link href={`/quiz/${relatedQuiz.id}`}>문제풀이 하러가기</Link>
                      </Button>
                    ) : (
                      <Button disabled className="w-full sm:w-auto">
                        문제풀이 없음
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  } catch (e: any) {
    console.error("[POST_DETAIL_ERROR]", e)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Alert variant="destructive" className="max-w-xl w-full">
          <AlertDescription>
            상세 페이지 로딩 중 서버 오류가 발생했습니다: {e?.message ?? "unknown"}
          </AlertDescription>
        </Alert>
      </div>
    )
  }
}
