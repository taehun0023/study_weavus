import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import DashboardHeader from "@/components/dashboard-header";
import ProjectsBoard from "@/components/projects/projects-board";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CourseRow = { id: number; name: string; slug: string };

interface Props {
  searchParams: Promise<{ course?: string; project?: string }>;
}

export default async function ProjectsPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const courseSlug = (params.course ?? "java").toLowerCase();

  const courses = await sql<CourseRow>`
    SELECT id, name, slug
    FROM courses
    ORDER BY id ASC
  `;

  const selected =
    courses.find((c) => c.slug.toLowerCase() === courseSlug) ?? courses[0];

  if (!selected) redirect("/posts");

  const isAdmin = user.user_role === "ADMIN";

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <main className="container mx-auto space-y-6 px-4 py-8">
        <div className="text-2xl font-bold">프로젝트</div>

        <ProjectsBoard
          courses={courses}
          selectedCourse={selected}
          initialProjectSlug={(params.project ?? "").toLowerCase()}
          isAdmin={isAdmin}
        />
      </main>
    </div>
  );
}
