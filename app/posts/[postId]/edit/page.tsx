// app/posts/[postId]/edit/page.tsx
export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { sql } from "@/lib/db"
import DashboardHeader from "@/components/dashboard-header"
import PostEditor from "@/components/post-editor"

type Params = { postId: string }
type CourseRow = { id: number; name: string; slug: string }
type DbDifficulty = "easy" | "medium" | "hard" | "project" | null
type EditorDifficulty = "easy" | "medium" | "project"

type PostRow = {
  id: number
  title: string
  content: string | null
  difficulty: DbDifficulty
  course_id: number
}

function toEditorDifficulty(d: DbDifficulty): EditorDifficulty {
  if (d === "medium") return "medium"
  if (d === "project" || d === "hard") return "project"
  return "easy"
}

export default async function EditPostPage({ params }: { params: Params }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.user_role !== "ADMIN") redirect("/posts")

  const id = Number.parseInt(params.postId, 10)
  if (!Number.isFinite(id) || id <= 0) redirect("/posts")

  const courses = await sql<CourseRow>`
    SELECT id, name, slug
    FROM public.courses
    ORDER BY name
  `

  const rows = await sql<PostRow>`
    SELECT id, title, content, difficulty, course_id
    FROM public.posts
    WHERE id = ${id}
    LIMIT 1
  `
  const post = rows?.[0]
  if (!post) redirect("/posts")

  // PostEditor가 초기값을 못 받는 구조라서, 아래 1줄이 중요:
  // PostEditor에 initial 값을 받도록 바꿔야 함 (다음 코드 C에서 제공)
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold">글 수정</h1>

        <PostEditor
          courses={courses}
          initial={{
            title: post.title ?? "",
            courseId: post.course_id,
            difficulty: toEditorDifficulty(post.difficulty),
            content: post.content ?? "",
          }}
          onSubmit={async (payload) => {
            const res = await fetch(`/api/posts/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
              alert(data?.message ?? `수정 실패 (${res.status})`)
              return
            }
            location.href = `/posts/${id}`
          }}
        />
      </main>
    </div>
  )
}
