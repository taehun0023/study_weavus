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

type PostRow = {
  id: number
  title: string
  content: string | null
  difficulty: "easy" | "medium" | "hard" | "project" | null
  course_id: number
}

export default async function EditPostPage({ params }: { params: Params }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.user_role !== "ADMIN") redirect("/posts")

  const postId = Number.parseInt(String(params.postId ?? ""), 10)
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

  const raw = post.content ?? ""
  const fixed = raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold">글 수정</h1>
        </div>

        <PostEditor
          courses={courses}
          mode="edit"
          postId={String(post.id)}
          initial={{
            title: post.title ?? "",
            courseId: post.course_id,
            difficulty: post.difficulty === "hard" ? "project" : (post.difficulty as any),
            content: fixed,
          }}
        />
      </main>
    </div>
  )
}
