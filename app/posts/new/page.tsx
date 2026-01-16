// app/posts/new/page.tsx
export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { sql } from "@/lib/db"
import DashboardHeader from "@/components/dashboard-header"
import LessonSetEditor from "@/components/lesson-set-editor"

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

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold">세트 작성</h1>
        </div>

        {/* 글작성은 세트 작성 UI(수업 + 선택: 참조/문제)로 통일 */}
        <LessonSetEditor courses={courses} />
      </main>
    </div>
  )
}
