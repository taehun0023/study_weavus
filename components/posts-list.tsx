// components/posts-list.tsx
import Link from "next/link"
import { sql } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type PostType = "lesson" | "quiz" | "reference"
type Difficulty = "easy" | "medium" | "hard" | "project" | null

type PostRow = {
  id: number
  title: string
  type: PostType
  difficulty: Difficulty
  course_name: string
}

function typeLabel(t: PostType): string {
  if (t === "lesson") return "수업내용"
  if (t === "quiz") return "문제풀이"
  return "참고자료"
}

function difficultyLabel(d: Difficulty): string {
  if (!d) return ""
  if (d === "hard") return "project"
  return d
}

function makeHref(row: PostRow): string {
  // quiz는 /quiz로 보내고, 나머지는 /posts 상세로
  return row.type === "quiz" ? `/quiz/${row.id}` : `/posts/${row.id}`
}

export async function PostsList({
  userId, // 향후 권한/진도관리용. 현재 미사용
  courseSlug,
  difficultyFilter = "all",
}: {
  userId: number
  courseSlug: string
  difficultyFilter?: string
}) {
  const rows = await sql<PostRow>`
    SELECT 
      p.id,
      p.title,
      p.type,
      p.difficulty,
      c.name as course_name
    FROM public.posts p
    JOIN public.courses c ON p.course_id = c.id
    WHERE c.slug = ${courseSlug}
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

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <Link key={row.id} href={makeHref(row)} prefetch className="block">
          <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{typeLabel(row.type)}</Badge>
                {row.difficulty && (
                  <Badge variant="secondary">{difficultyLabel(row.difficulty)}</Badge>
                )}
              </div>
              <CardTitle className="mt-2">{row.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              과목: {row.course_name}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
