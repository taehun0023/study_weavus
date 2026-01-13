// components/posts-list.tsx
import Link from "next/link"
import { sql } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import PostAdminActions from "@/components/post-admin-actions"

type Difficulty = "easy" | "medium" | "hard" | "project" | null

type PostRow = {
  id: number | string // ✅ Neon/pg에서 string으로 올 때도 있어서 넉넉하게
  title: string
  difficulty: Difficulty
  course_name: string
}

function difficultyLabel(d: Difficulty): string {
  if (!d) return ""
  if (d === "hard") return "project"
  return d
}

function normalizedDifficulty(d: Difficulty): "easy" | "medium" | "project" | null {
  if (!d) return null
  if (d === "hard" || d === "project") return "project"
  if (d === "easy") return "easy"
  if (d === "medium") return "medium"
  return null
}

function difficultyClass(d: Difficulty): string {
  const nd = normalizedDifficulty(d)
  if (nd === "easy") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
  if (nd === "medium") return "bg-yellow-500/15 text-yellow-200 border-yellow-500/30"
  if (nd === "project") return "bg-sky-500/15 text-sky-200 border-sky-500/30"
  return ""
}

function buildReturnHref(courseSlug: string, difficultyFilter: string) {
  const params = new URLSearchParams()
  params.set("course", courseSlug)
  if (difficultyFilter && difficultyFilter !== "all") params.set("difficulty", difficultyFilter)
  const qs = params.toString()
  return qs ? `/posts?${qs}` : "/posts"
}

export async function PostsList({
  courseSlug,
  difficultyFilter = "all",
  lessonOnly = false,
  isAdmin = false,
}: {
  courseSlug: string
  difficultyFilter?: string
  lessonOnly?: boolean
  isAdmin?: boolean
}) {
  const rows = await sql<PostRow>`
    SELECT 
      p.id,
      p.title,
      p.difficulty,
      c.name as course_name
    FROM public.posts p
    JOIN public.courses c ON p.course_id = c.id
    WHERE c.slug = ${courseSlug}
      AND (
        ${lessonOnly} = false OR p.type = 'lesson'
      )
      AND (
        ${difficultyFilter} = 'all'
        OR (
          ${difficultyFilter} = 'project' AND p.difficulty IN ('project','hard')
        )
        OR (
          ${difficultyFilter} IN ('easy','medium') AND p.difficulty = ${difficultyFilter}
        )
      )
    ORDER BY p.id
  `

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        해당 조건에 맞는 게시글이 없습니다.
      </div>
    )
  }

  const returnHref = buildReturnHref(courseSlug, difficultyFilter)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => {
        const postId = String(row.id) // ✅ 무조건 string으로 통일해서 client로 넘김

        return (
          <Card
            key={postId}
            className="relative bg-card border-border hover:border-primary/50 transition-colors h-full"
          >
            {/* ✅ 관리자 버튼: 카드 오른쪽 상단 (클릭해도 상세로 안 튐) */}
            {isAdmin && (
              <div className="absolute right-3 top-3 z-20">
                <PostAdminActions
                  postId={postId}
                  editHref={`/posts/${postId}/edit`}
                  afterDeleteHref={returnHref}
                  size="sm"
                />
              </div>
            )}

            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2 pr-20">
                <Badge variant="outline">수업내용</Badge>

                {row.difficulty && (
                  <Badge variant="outline" className={difficultyClass(row.difficulty)}>
                    {difficultyLabel(row.difficulty)}
                  </Badge>
                )}
              </div>

              {/* ✅ 제목 클릭하면 상세로 */}
              <CardTitle className="mt-2">
                <Link href={`/posts/${postId}`} className="hover:underline">
                  {row.title}
                </Link>
              </CardTitle>
            </CardHeader>

            <CardContent className="text-sm text-muted-foreground">
              과목: {row.course_name}
            </CardContent>

            {/* ✅ 카드 바디 클릭해도 상세로 (버튼은 z-20이라 영향 없음) */}
            <Link
              href={`/posts/${postId}`}
              className="absolute inset-0 z-10 rounded-2xl"
              aria-label="open post"
            />
          </Card>
        )
      })}
    </div>
  )
}
