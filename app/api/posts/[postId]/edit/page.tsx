export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { sql } from "@/lib/db"
import DashboardHeader from "@/components/dashboard-header"
import PostEditForm from "@/components/post-edit-form"

type PostRow = {
  id: number
  title: string
  content: string | null
  difficulty: string | null
}

export default async function EditPostPage({ params }: { params: { postId: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.user_role !== "ADMIN") redirect("/posts")

  const id = parseInt(params.postId, 10)
  if (!Number.isFinite(id) || id <= 0) redirect("/posts")

  const rows = await sql<PostRow>`
    SELECT id, title, content, difficulty
    FROM public.posts
    WHERE id = ${id}
    LIMIT 1
  `
  const post = rows?.[0]
  if (!post) redirect("/posts")

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-8">
        <PostEditForm post={post} />
      </main>
    </div>
  )
}
