// components/posts-list.tsx
import { sql } from "@/lib/db"
import PostCardClient from "@/components/post-card-client"

type Difficulty = "easy" | "medium" | "hard" | "project" | null

type PostRow = {
  id: number | string
  title: string
  difficulty: Difficulty
  course_name: string
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
      AND (${lessonOnly} = false OR p.type = 'lesson')
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
    <div className="grid gap-6 md:grid-cols-2">
      {rows.map((row) => {
        const postId = String(row.id)
        return (
          <PostCardClient
            key={postId}
            postId={postId}
            title={row.title}
            difficulty={row.difficulty}
            courseName={row.course_name}
            isAdmin={isAdmin}
            returnHref={returnHref}
          />
        )
      })}
    </div>
  )
}
