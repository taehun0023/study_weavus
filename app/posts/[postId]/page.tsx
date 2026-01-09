import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { getCurrentUser } from "@/lib/auth"
import { sql } from "@/lib/db"
import DashboardHeader from "@/components/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BookOpen, FileText, ExternalLink } from "lucide-react"

interface PostDetailPageProps {
  params: Promise<{
    postId: string
  }>
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const { postId } = await params

  const posts = await sql`
    SELECT 
      p.id,
      p.title,
      p.type,
      p.difficulty,
      p.content,
      c.name as course_name,
      c.slug as course_slug
    FROM posts p
    JOIN courses c ON p.course_id = c.id
    WHERE p.id = ${postId}
  `

  const post = posts[0]

  if (!post) {
    notFound()
  }

  // Redirect to quiz page if it's a quiz
  if (post.type === "quiz") {
    redirect(`/quiz/${postId}`)
  }

  const typeLabels = {
    lesson: "수업내용",
    quiz: "문제풀이",
    reference: "참고자료",
  }

  const TypeIcon = post.type === "lesson" ? BookOpen : FileText

  // Check if content is a URL (for reference type)
  const isExternalLink = post.type === "reference" && post.content?.startsWith("http")

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href={`/posts?course=${post.course_slug}`}>
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            목록으로
          </Button>
        </Link>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">
                <TypeIcon className="h-3 w-3 mr-1" />
                {typeLabels[post.type as keyof typeof typeLabels]}
              </Badge>
              <Badge variant="secondary">{post.course_name}</Badge>
            </div>
            <CardTitle className="text-2xl text-foreground">{post.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {isExternalLink ? (
              <div className="space-y-4">
                <p className="text-muted-foreground">외부 참고자료 링크입니다.</p>
                <a href={post.content} target="_blank" rel="noopener noreferrer">
                  <Button>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    링크 열기
                  </Button>
                </a>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-foreground">{post.content || "내용이 없습니다."}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
