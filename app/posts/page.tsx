// app/posts/page.tsx
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import DashboardHeader from "@/components/dashboard-header"
import { PostsList } from "@/components/posts-list"

interface PostsPageProps {
  // Next.js App Router: searchParams는 Promise가 아니라 plain object로 전달됩니다.
  searchParams?: {
    course?: string
  }
}

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const courseSlug = searchParams?.course || "java"

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">게시글 목록</h1>

        {/* ✅ 목록에는 수업내용만 */}
        <PostsList userId={user.id} courseSlug={courseSlug} />
      </main>
    </div>
  )
}
