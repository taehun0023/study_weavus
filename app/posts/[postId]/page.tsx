// app/posts/[postId]/page.tsx
export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

import Link from "next/link"
import { redirect } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import sanitizeHtml from "sanitize-html"

import { getCurrentUser } from "@/lib/auth"
import { sql } from "@/lib/db"

import DashboardHeader from "@/components/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Difficulty = "easy" | "medium" | "hard" | "project" | null

type PostRow = {
  id: number
  title: string
  content: string | null
  difficulty: Difficulty
  course_name: string
  course_slug: string
}

export default async function PostDetailPage({
  params,
}: {
  params: { postId?: string }
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  // 🔥 핵심: postId를 정확히 숫자로 변환
  const rawId = params?.postId
  const postId = Number.parseInt(String(rawId), 10)

  if (!Number.isFinite(postId) || postId <= 0) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader user={user} />
        <main className="container mx-auto px-4 py-10">
          <div className="text-red-500">잘못된 postId 입니다</div>
        </main>
      </div>
    )
  }

  const rows = await sql<PostRow>`
    SELECT
      p.id,
      p.title,
      p.content,
      p.difficulty,
      c.name as course_name,
      c.slug as course_slug
    FROM public.posts p
    JOIN public.courses c ON p.course_id = c.id
    WHERE p.id = ${postId}
    LIMIT 1
  `
  const post = rows[0]

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader user={user} />
        <main className="container mx-auto px-4 py-10">
          <div className="text-muted-foreground">게시글이 없습니다.</div>
        </main>
      </div>
    )
  }

  const raw = post.content ?? ""
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(raw)

  const safeHtml = isHtml
    ? sanitizeHtml(raw, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
        allowedAttributes: {
          a: ["href", "target", "rel"],
          img: ["src", "alt"],
        },
      })
    : ""

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <Button asChild variant="ghost">
          <Link href={`/posts?course=${post.course_slug}`}>← 목록으로</Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{post.title}</CardTitle>
            <Badge>{post.course_name}</Badge>
          </CardHeader>

          <CardContent className="prose prose-invert max-w-none">
            {isHtml ? (
              <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {raw}
              </ReactMarkdown>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
