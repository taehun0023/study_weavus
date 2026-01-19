// app/posts/[postId]/edit-set/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

import DashboardHeader from "@/components/dashboard-header";
import LessonSetEditorEdit from "@/components/lesson-set-editor-edit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CourseRow = { id: number; name: string; slug: string };

const INTERVIEW_COURSE_ID = -1;

export default async function EditSetPage({
  params,
}: {
  params: { postId: string } | Promise<{ postId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.user_role !== "ADMIN") redirect("/posts");

  const p = (params as any)?.then
    ? await (params as Promise<{ postId: string }>)
    : (params as any);

  const lessonId = Number.parseInt(String(p?.postId ?? ""), 10);
  if (!Number.isFinite(lessonId) || lessonId <= 0) redirect("/posts");

  const rows = await sql<{ id: number }>`
    SELECT id
    FROM public.posts
    WHERE id = ${lessonId} AND type = 'lesson'
    LIMIT 1
  `;
  if (!rows[0]) redirect(`/posts/${lessonId}`);

  const courses = await sql<CourseRow>`
    SELECT id, name, slug
    FROM public.courses
    ORDER BY id ASC
  `;

  const coursesWithInterview: CourseRow[] = [
    ...courses,
    { id: INTERVIEW_COURSE_ID, name: "면접", slug: "interview" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      {/* Same layout/tone as the create page */}
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="text-2xl font-bold">세트 수정 (수업 + 참조 + 문제)</div>
        <LessonSetEditorEdit courses={coursesWithInterview} lessonId={lessonId} />
      </main>
    </div>
  );
}
