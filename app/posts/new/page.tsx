// app/admin/posts/new/page.tsx
export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { sql } from "@/lib/db"
import DashboardHeader from "@/components/dashboard-header"
import PostEditor from "@/components/post-editor"

type CourseRow = { id: number; name: string; slug: string }

export default async function NewPostPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.user_role !== "ADMIN") redirect("/posts")

  const courses = await sql<CourseRow>`
    SELECT id, name, slug
    FROM public.courses
    ORDER BY name
  `

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">글작성</h1>
          <p className="text-sm text-muted-foreground">
            마크다운으로 작성하면 상세페이지에서 보기 좋게 렌더링됩니다.
          </p>
        </div>

        <PostEditor courses={courses} />
      </main>
    </div>
  )
}
