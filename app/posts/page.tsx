import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { DashboardHeader } from "@/components/dashboard-header"
import { PostsFilter } from "@/components/posts-filter"
import { PostsList } from "@/components/posts-list"

interface PostsPageProps {
  searchParams: Promise<{
    course?: string
    type?: string
  }>
}

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const params = await searchParams
  const courseSlug = params.course || "java"
  const typeFilter = params.type || "all"

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">게시글 목록</h1>
        </div>
        <PostsFilter currentCourse={courseSlug} currentType={typeFilter} />
        <PostsList userId={user.id} courseSlug={courseSlug} typeFilter={typeFilter} />
      </main>
    </div>
  )
}
