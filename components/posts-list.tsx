// components/posts-list.tsx
import Link from "next/link"
import { sql } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
} as const

const typeLabels = {
  lesson: "수업내용",
  quiz: "문제풀이",
  reference: "참고자료",
} as const

const difficultyLabels = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
} as const

const difficultyColors = {
  easy: "border-green-500/50 text-green-500",
  medium: "border-yellow-500/50 text-yellow-500",
  hard: "border-red-500/50 text-red-500",
} as const

type PostRow = {
  id: number
  title: string
  type: "lesson" | "quiz" | "reference"
  difficulty: "easy" | "medium" | "hard" | null
  course_name: string
  course_slug: string
  completed: boolean | null
  best_score: number | null
  question_count: number
}

export async function PostsList({ userId, courseSlug, typeFilter }: PostsListProps) {
  try {
    const posts = await sql<PostRow>`
      SELECT 
        p.id,
        p.title,
        p.type,
        p.difficulty,
        c.name as course_name,
        c.slug as course_slug,
        uqp.completed,
        uqp.best_score,
        (SELECT COUNT(*) FROM public.quiz_questions qq WHERE qq.post_id = p.id) as question_count
      FROM public.posts p
      JOIN public.courses c ON p.course_id = c.id
      LEFT JOIN public.user_quiz_progress uqp 
        ON p.id = uqp.post_id AND uqp.user_id = ${userId}
      WHERE c.slug = ${courseSlug}
        AND (${typeFilter} = 'all' OR p.type = ${typeFilter})
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
          const IconComponent = typeIcons[post.type] || FileText
          const typeLabel = typeLabels[post.type] || post.type
          const isQuiz = post.type === "quiz"
          const href = isQuiz ? `/quiz/${post.id}` : `/posts/${post.id}`

          const completed = !!post.completed
          const bestScore = Number(post.best_score) || 0
          const questionCount = Number(post.question_count) || 0

          return (
            <Link href={href} key={post.id}>
              <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="outline" className="mb-2">
                        <IconComponent className="h-3 w-3 mr-1" />
                        {typeLabel}
                      </Badge>

                      {post.difficulty && (
                        <Badge
                          variant="outline"
                          className={`ml-2 ${difficultyColors[post.difficulty] ?? ""}`}
                        >
                          {difficultyLabels[post.difficulty] ?? post.difficulty}
                        </Badge>
                      )}
                    </div>

                    {isQuiz && (
                      <div className="flex items-center gap-1 text-sm">
                        {completed ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={completed ? "text-green-500" : "text-muted-foreground"}>
                          {completed ? "완료" : "미완료"}
                        </span>
                      </div>
                    )}
                  </div>

                  <CardTitle className="text-foreground line-clamp-2">{post.title}</CardTitle>
                </CardHeader>

                <CardContent className="space-y-2">
                  {isQuiz && (
                    <div className="text-sm text-muted-foreground flex justify-between">
                      <span>문항 수: {questionCount}</span>
                      <span>최고 점수: {bestScore}점</span>
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    과목: {post.course_name}
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    )
  } catch (e: any) {
    // ✅ 여기서 실제 원인이 로그로 남음 (Vercel Runtime Logs에서 확인 가능)
    console.error("[POSTS_LIST_ERROR]", e)

    return (
      <Alert variant="destructive">
        <AlertDescription>
          게시글 목록을 불러오는 중 오류가 발생했습니다. (서버 로그를 확인해주세요)
        </AlertDescription>
      </Alert>
    )
  }
}
