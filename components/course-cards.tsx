import type React from "react";
import Link from "next/link";
import { sql } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Coffee, Database, Network, Code } from "lucide-react";

interface CourseCardsProps {
  userId: number;
}

const courseIcons: Record<string, React.ElementType> = {
  coffee: Coffee,
  database: Database,
  network: Network,
  code: Code,
};

export async function CourseCards({ userId }: CourseCardsProps) {
  const courses = await sql`
  SELECT 
    c.id,
    c.name,
    c.slug,
    c.description,
    c.icon,
    COUNT(DISTINCT p.id) FILTER (WHERE p.type = 'quiz') as total_quizzes,
    COUNT(DISTINCT uqp.post_id) FILTER (WHERE uqp.completed = true AND p.type = 'quiz') as completed_quizzes
  FROM courses c
  LEFT JOIN posts p ON c.id = p.course_id
  LEFT JOIN user_quiz_progress uqp ON p.id = uqp.post_id AND uqp.user_id = ${userId}
  WHERE c.slug <> 'interview'
  GROUP BY c.id, c.name, c.slug, c.description, c.icon
  ORDER BY c.name
`;

  return (
    <section>
      <h2 className="text-xl font-semibold text-foreground mb-4">학습 과목</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => {
          const totalQuizzes = Number(course.total_quizzes) || 0;
          const completedQuizzes = Number(course.completed_quizzes) || 0;
          const progressPercent =
            totalQuizzes > 0
              ? Math.round((completedQuizzes / totalQuizzes) * 100)
              : 0;
          const IconComponent = courseIcons[course.icon || "code"] || Code;

          return (
            <Link href={`/posts?course=${course.slug}`} key={course.id}>
              <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-3 text-foreground">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    {course.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {course.description && (
                    <p className="text-sm text-muted-foreground">
                      {course.description}
                    </p>
                  )}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        퀴즈 완료: {completedQuizzes} / {totalQuizzes}
                      </span>
                      <span className="font-medium text-foreground">
                        {progressPercent}%
                      </span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
