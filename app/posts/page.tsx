// app/posts/page.tsx
export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import DashboardHeader from "@/components/dashboard-header"
import { PostsFilter } from "@/components/posts-filter"
import { PostsList } from "@/components/posts-list"
import { sql } from "@/lib/db"

type CourseRow = {
  name: string
  slug: string
}

interface PostsPageProps {
  searchParams?: {
    course?: string
    difficulty?: string
  }
}

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const currentCourse = searchParams?.course || "java"
  const currentDifficulty = searchParams?.difficulty || "all"

  const courses = await sql<CourseRow>`
    SELECT name, slug
    FROM public.courses
    ORDER BY name
  `

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold text-foreground">게시글 목록</h1>

          <PostsFilter
            courses={courses}
            currentCourse={currentCourse}
            currentDifficulty={currentDifficulty}
          />
        </div>

        {/* ✅ 일람은 수업내용만 보여줄 거라 lessonOnly 켬 */}
        <PostsList
          courseSlug={currentCourse}
          difficultyFilter={currentDifficulty}
          lessonOnly
        />
      </main>
    </div>
  )
}
