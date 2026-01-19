// app/posts/new/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import DashboardHeader from "@/components/dashboard-header";
import LessonSetEditor from "@/components/lesson-set-editor";

type CourseRow = { id: number; name: string; slug: string };

const INTERVIEW_COURSE_ID = -1;

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: { course?: string } | Promise<{ course?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.user_role !== "ADMIN") redirect("/posts");

  const params = (searchParams as any)?.then
    ? await (searchParams as Promise<{ course?: string }> )
    : (searchParams as any);

  const courses = await sql<CourseRow>`
    SELECT id, name, slug
    FROM public.courses
    ORDER BY name
  `;

  // Add virtual "interview" option to the same dropdown.
  const coursesWithInterview: CourseRow[] = [
    ...courses,
    { id: INTERVIEW_COURSE_ID, name: "면접", slug: "interview" },
  ];

  const initialCourseId =
    String(params?.course ?? "").toLowerCase() === "interview"
      ? INTERVIEW_COURSE_ID
      : undefined;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold">세트 작성</h1>
        </div>

        {/* One editor UI. Only the save target changes when course is "interview". */}
        <LessonSetEditor courses={coursesWithInterview} initialCourseId={initialCourseId} />
      </main>
    </div>
  );
}
