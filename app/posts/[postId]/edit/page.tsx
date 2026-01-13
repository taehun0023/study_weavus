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
type EditorDifficulty = "easy" | "medium" | "project" | null

type PostRow = {
  id: number
  title: string
  content: string | null
  difficulty: DbDifficulty
  course_id: number
}

function toEditorDifficulty(d: DbDifficulty): EditorDifficulty {
  if (!d) return null
  if (d === "hard") return "project"
  if (d === "project") return "project"
  if (d === "easy") return "easy"
  if (d === "medium") return "medium"
  return null
}

export default async function EditPostPage({ params }: { params: Params }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.user_role !== "ADMIN") redirect("/posts")

  const postId = Number.parseInt(params.postId, 10)
  if (!Number.isFinite(postId) || postId <= 0) redirect("/posts")

  const courses = await sql<CourseRow>`
    SELECT id, name, slug
    FROM public.courses
    ORDER BY name
  `

  const rows = await sql<PostRow>`
    SELECT id, title, content, difficulty, course_id
    FROM public.posts
    WHERE id = ${postId}
    LIMIT 1
  `
  const post = rows?.[0]
  if (!post) redirect("/posts")

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold">글 수정</h1>

        <PostEditor
          courses={courses}
          mode="edit"
          postId={String(post.id)}
          initial={{
            title: post.title ?? "",
            courseId: post.course_id,
            difficulty: toEditorDifficulty(post.difficulty),
            content: post.content ?? "",
          }}
        />
      </main>
    </div>
  )
}
