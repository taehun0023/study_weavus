import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import DashboardHeader from "@/components/dashboard-header";
import LessonSetEditor from "@/components/lesson-set-editor";

type CourseRow = { id: number; name: string; slug: string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewSetPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.user_role !== "ADMIN") redirect("/posts");

  const courses = await sql<CourseRow>`
    SELECT id, name, slug
    FROM public.courses
    ORDER BY id ASC
  `;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="text-2xl font-bold">세트 작성 (수업 + 참조 + 문제)</div>
        <LessonSetEditor courses={courses} />
      </main>
    </div>
  );
}
