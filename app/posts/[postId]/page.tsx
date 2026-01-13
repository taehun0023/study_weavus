// app/posts/[postId]/page.tsx
import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { sql } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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
  type: "quiz" | "reference"
}

function normalizeTitleForMatch(title: string) {
  return title
    .replace(/\s*(수업내용|강의|이론|문법|개념|정리)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

async function findRelated(
  courseId: number,
  baseTitle: string,
  type: "quiz" | "reference"
): Promise<RelatedPost | null> {
  const q1 = await sql<RelatedPost>`
    SELECT id, title, type
    FROM public.posts
    WHERE course_id = ${courseId}
      AND type = ${type}
      AND title ILIKE ${"%" + baseTitle + "%"}
    ORDER BY id
    LIMIT 1
  `
  if (q1[0]) return q1[0]

  const q2 = await sql<RelatedPost>`
    SELECT id, title, type
    FROM public.posts
    WHERE course_id = ${courseId}
      AND type = ${type}
    ORDER BY id
    LIMIT 1
  `
  return q2[0] ?? null
}

type ParamsLike = { postId: string } | Promise<{ postId: string }>

export default async function PostDetailPage({ params }: { params: ParamsLike }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  // ✅ params가 Promise든 아니든 안전하게 처리
  const { postId: postIdRaw } = await params
  const postId = Number.parseInt(postIdRaw, 10)

  // 여기서 NaN이면 /posts/1 이라도 코드 문제(대부분 params 처리 문제)
  if (!Number.isInteger(postId)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardHeader>
            <CardTitle className="text-red-500">잘못된 postId 입니다!</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2 justify-end">
            <Button asChild variant="secondary">
              <Link href="/posts">목록으로</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

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

  // 글이 진짜 없으면 여기로 옴 (invalid postId 메시지랑 원인이 다름)
  if (!post) redirect("/posts")

  let relatedQuiz: RelatedPost | null = null
  let relatedRef: RelatedPost | null = null

  if (post.type === "lesson") {
    const base = normalizeTitleForMatch(post.title)
    relatedQuiz = await findRelated(post.course_id, base, "quiz")
    relatedRef = await findRelated(post.course_id, base, "reference")
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost">
            <Link href="/posts">← 목록으로</Link>
          </Button>

          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {post.type === "lesson"
                ? "수업내용"
                : post.type === "reference"
                ? "참고자료"
                : "문제풀이"}
            </Badge>
            <Badge variant="secondary">{post.course_name}</Badge>
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-2xl">{post.title}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="text-foreground whitespace-pre-wrap leading-7">
              {post.content}
            </div>

            {post.type === "lesson" && (
              <div className="space-y-3 pt-2">
                <div className="text-sm text-muted-foreground">
                  수업내용을 학습한 뒤, 참고자료를 보고 문제풀이로 확인하세요.
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
            )     }
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
