import Link from "next/link"
import { sql } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, FileQuestion, FileText, CheckCircle, XCircle } from "lucide-react"

interface PostsListProps {
  userId: number
  courseSlug: string
  typeFilter: string
}

const typeIcons = {
  lesson: BookOpen,
  quiz: FileQuestion,
  reference: FileText,
}

const typeLabels = {
  lesson: "수업내용",
  quiz: "문제풀이",
  reference: "참고자료",
}

const difficultyColors = {
  easy: "bg-green-500/20 text-green-400 border-green-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  hard: "bg-red-500/20 text-red-400 border-red-500/30",
}

const difficultyLabels = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
}

export async function PostsList({ userId, courseSlug, typeFilter }: PostsListProps) {
  // Build query based on filters
  const posts = await sql`
    SELECT 
      p.id,
      p.title,
      p.type,
      p.difficulty,
      p.content,
      c.name as course_name,
      c.slug as course_slug,
      uqp.completed,
      uqp.best_score,
      (SELECT COUNT(*) FROM quiz_questions WHERE post_id = p.id) as question_count
    FROM posts p
    JOIN courses c ON p.course_id = c.id
    LEFT JOIN user_quiz_progress uqp ON p.id = uqp.post_id AND uqp.user_id = ${userId}
    WHERE c.slug = ${courseSlug}
    ${typeFilter !== "all" ? sql`AND p.type = ${typeFilter}` : sql``}
    ORDER BY p.type, p.id
  `

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">해당 조건에 맞는 게시글이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => {
        const IconComponent = typeIcons[post.type as keyof typeof typeIcons] || FileText
        const typeLabel = typeLabels[post.type as keyof typeof typeLabels] || post.type
        const isQuiz = post.type === "quiz"
        const questionCount = Number(post.question_count) || 0

        // Determine link based on post type
        const href = isQuiz ? `/quiz/${post.id}` : `/posts/${post.id}`

        return (
          <Link href={href} key={post.id}>
            <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <Badge variant="outline" className="mb-2">
                    <IconComponent className="h-3 w-3 mr-1" />
                    {typeLabel}
                  </Badge>
                  {post.difficulty && (
                    <Badge
                      variant="outline"
                      className={difficultyColors[post.difficulty as keyof typeof difficultyColors]}
                    >
                      {difficultyLabels[post.difficulty as keyof typeof difficultyLabels]}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg text-foreground">{post.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {isQuiz ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{questionCount}문제</span>
                    <div className="flex items-center gap-2">
                      {post.completed ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          완료
                        </Badge>
                      ) : post.best_score !== null && post.best_score > 0 ? (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          최고 {post.best_score}/{questionCount}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          미시도
                        </Badge>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {post.content?.substring(0, 100) || "내용 없음"}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
