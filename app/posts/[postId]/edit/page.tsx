// app/posts/[postId]/edit/page.tsx
export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { sql } from "@/lib/db"

import DashboardHeader from "@/components/dashboard-header"
import PostEditor, { Course, Difficulty, PostEditorPayload } from "@/components/post-editor"

type DbDifficulty = "easy" | "medium" | "hard" | "project" | null

type PostRow = {
  id: number
  title: string
  content: string | null
  course_id: number
  difficulty: DbDifficulty
}

function toEditorDifficulty(d: DbDifficulty): Difficulty {
  if (d === "medium") return "medium"
  if (d === "project" || d === "hard") return "project"
  return "easy" // null 포함 기본값
}

export default async function EditPostPage({ params }: { params: { postId: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.user_role !== "ADMIN") redirect("/posts")

  const postId = Number.parseInt(params.postId, 10)
  if (!Number.isFinite(postId) || postId <= 0) redirect("/posts")

  const courses = await sql<Course>`
    SELECT id, name, slug
    FROM public.courses
    ORDER BY name
  `

  const rows = await sql<PostRow>`
    SELECT id, title, content, course_id, difficulty
    FROM public.posts
    WHERE id = ${postId}
    LIMIT 1
  `
  const post = rows[0]
  if (!post) redirect("/posts")

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold">글 수정</h1>

        <PostEditor
          courses={courses}
          initial={{
            title: post.title ?? "",
            content: post.content ?? "",
            courseId: post.course_id,
            difficulty: toEditorDifficulty(post.difficulty),
          }}
          onSubmit={async (payload: PostEditorPayload) => {
            const res = await fetch(`/api/posts/${postId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })

            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
              alert(data?.message ?? `수정 실패 (${res.status})`)
              return
            }

            window.location.href = `/posts/${postId}`
          }}
        />
      </main>
    </div>
  )
}
