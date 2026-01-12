// components/posts-list.tsx
import Link from "next/link"
import { sql } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type LessonRow = {
  id: number
  title: string
  difficulty: "easy" | "medium" | "hard" | null
  course_name: string
}

export async function PostsList({
  userId,
  courseSlug,
}: {
  userId: number
  courseSlug: string
}) {
  // ✅ lesson만 가져오기 (일람에는 수업내용만!)
  const lessons = await sql<LessonRow>`
    SELECT 
      p.id,
      p.title,
      p.difficulty,
      c.name as course_name
    FROM public.posts p
    JOIN public.courses c ON p.course_id = c.id
    WHERE c.slug = ${courseSlug}
      AND p.type = 'lesson'
    ORDER BY p.id
  `

  if (lessons.length === 0) {
    return <div className="text-muted-foreground">수업내용이 없습니다.</div>
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {lessons.map((lesson) => (
        <Link key={lesson.id} href={`/posts/${lesson.id}`} className="block">
          <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">수업내용</Badge>
                {lesson.difficulty && <Badge variant="secondary">{lesson.difficulty}</Badge>}
              </div>
              <CardTitle className="mt-2">{lesson.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              과목: {lesson.course_name}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
