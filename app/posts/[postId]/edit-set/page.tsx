// app/posts/[postId]/edit-set/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import DashboardHeader from "@/components/dashboard-header";
import LessonSetEditorEdit from "@/components/lesson-set-editor-edit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CourseRow = { id: number; name: string; slug: string };

export default async function EditSetPage({
  params,
}: {
  params: { postId: string } | Promise<{ postId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.user_role !== "ADMIN") redirect("/posts");

  // Next 16 환경에서 params가 Promise로 오는 케이스도 커버
  const p = (params as any)?.then
    ? await (params as Promise<{ postId: string }>)
    : (params as any);
  const lessonId = Number.parseInt(String(p?.postId ?? ""), 10);
  if (!Number.isFinite(lessonId) || lessonId <= 0) redirect("/posts");

  // lesson 타입만 edit-set 접근 가능
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

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold">세트 수정</h1>
        <LessonSetEditorEdit courses={courses} lessonId={lessonId} />
      </main>
    </div>
  );
}
