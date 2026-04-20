import type React from "react";
import Link from "next/link";
import { sql } from "@/lib/db";
import { listCourses } from "@/lib/courses";
import { Progress } from "@/components/ui/progress";
import { Coffee, Database, Network, Code, BookOpen, PenSquare, Mic } from "lucide-react";

interface CourseCardsProps {
  userId: number;
  userRole: "ADMIN" | "USER";
}

type CourseIconKey = "coffee" | "database" | "network" | "code";

const courseIcons: Record<string, React.ElementType> = {
  coffee: Coffee,
  database: Database,
  network: Network,
  code: Code,
};

/* Per-icon colour accent (bg gradient + icon colour) */
const courseAccents: Record<string, { gradient: string; iconColor: string; iconBg: string }> = {
  coffee: {
    gradient: "from-amber-500/10 to-orange-500/5",
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/15 border border-amber-500/20",
  },
  database: {
    gradient: "from-sky-500/10 to-blue-500/5",
    iconColor: "text-sky-400",
    iconBg: "bg-sky-500/15 border border-sky-500/20",
  },
  network: {
    gradient: "from-violet-500/10 to-purple-500/5",
    iconColor: "text-violet-400",
    iconBg: "bg-violet-500/15 border border-violet-500/20",
  },
  code: {
    gradient: "from-primary/10 to-primary/5",
    iconColor: "text-primary",
    iconBg: "bg-primary/15 border border-primary/20",
  },
};

const defaultAccent = courseAccents.code;

const writingAccent = {
  gradient: "from-emerald-500/10 to-teal-500/5",
  iconColor: "text-emerald-300",
  iconBg: "bg-emerald-500/15 border border-emerald-500/25",
};

const speakingAccent = {
  gradient: "from-cyan-500/10 to-blue-500/5",
  iconColor: "text-cyan-300",
  iconBg: "bg-cyan-500/15 border border-cyan-500/25",
};

export async function CourseCards({ userId, userRole }: CourseCardsProps) {
  const visibleCourses = await listCourses({
    includePrivate: userRole === "ADMIN",
  });
  const visibleIds = new Set(visibleCourses.map((c) => Number(c.id)));

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

  const visible = courses.filter((course) => visibleIds.has(Number(course.id)));

  return (
    <section>
      <div className="flex items-center gap-2 mb-5">
        <BookOpen className="h-4.5 w-4.5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">학습 과목</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/japanese-writing">
          <div
            className={`relative rounded-xl border border-border/60 bg-gradient-to-br ${writingAccent.gradient} bg-card p-5 cursor-pointer transition-all duration-200 hover:border-border hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 h-full flex flex-col gap-4`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${writingAccent.iconBg}`}>
                <PenSquare className={`h-5 w-5 ${writingAccent.iconColor}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground leading-tight">
                  日本語作文
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  N1〜N5 레벨별 한국어→일본어 작문 및 AI 첨삭
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>연습 유형</span>
                <span className="font-medium text-foreground">AI 作文レビュー</span>
              </div>
              <Progress value={100} className="h-1.5" />
            </div>
          </div>
        </Link>

        <Link href="/japanese-speaking">
          <div
            className={`relative rounded-xl border border-border/60 bg-gradient-to-br ${speakingAccent.gradient} bg-card p-5 cursor-pointer transition-all duration-200 hover:border-border hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 h-full flex flex-col gap-4`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${speakingAccent.iconBg}`}>
                <Mic className={`h-5 w-5 ${speakingAccent.iconColor}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground leading-tight">
                  日本語音声評価
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  녹음 파일 업로드 기반 발음/억양/문법/자연스러움 평가
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>연습 유형</span>
                <span className="font-medium text-foreground">AI 音声レビュー</span>
              </div>
              <Progress value={100} className="h-1.5" />
            </div>
          </div>
        </Link>

        {visible.map((course) => {
          const totalQuizzes = Number(course.total_quizzes) || 0;
          const completedQuizzes = Number(course.completed_quizzes) || 0;
          const progressPercent =
            totalQuizzes > 0
              ? Math.round((completedQuizzes / totalQuizzes) * 100)
              : 0;

          const iconKey = (course.icon ?? "code") as string;
          const IconComponent = courseIcons[iconKey] || Code;
          const accent = courseAccents[iconKey] ?? defaultAccent;

          const isDone = totalQuizzes > 0 && completedQuizzes === totalQuizzes;

          return (
            <Link href={`/posts?course=${course.slug}`} key={course.id}>
              <div
                className={`relative rounded-xl border border-border/60 bg-gradient-to-br ${accent.gradient} bg-card p-5 cursor-pointer transition-all duration-200 hover:border-border hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 h-full flex flex-col gap-4`}
              >
                {/* Header row */}
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${accent.iconBg}`}>
                    <IconComponent className={`h-5 w-5 ${accent.iconColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground leading-tight">
                      {course.name}
                    </div>
                    {course.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {course.description}
                      </div>
                    )}
                  </div>
                  {isDone && (
                    <span className="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded diff-pass">
                      완료
                    </span>
                  )}
                </div>

                {/* Progress */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>퀴즈 진행도</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {completedQuizzes} / {totalQuizzes}
                      <span className="text-muted-foreground ml-1">
                        ({progressPercent}%)
                      </span>
                    </span>
                  </div>
                  <Progress value={progressPercent} className="h-1.5" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
