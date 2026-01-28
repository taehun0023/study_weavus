import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import DashboardHeader from "@/components/dashboard-header";
import ProjectDetail from "@/components/projects/project-detail";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProjectRow = { id: number; name: string; slug: string; course_id: number };

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { projectId } = await params;
  const idNum = Number(projectId);
  if (!Number.isFinite(idNum)) redirect("/projects");

  const rows = await sql<ProjectRow>`
    SELECT id, name, slug, course_id
    FROM public.projects
    WHERE id = ${idNum}
    LIMIT 1
  `;
  const project = rows[0];
  if (!project) redirect("/projects");

  const isAdmin = user.user_role === "ADMIN";

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <main className="container mx-auto space-y-6 px-4 py-8">
        <ProjectDetail project={project} isAdmin={isAdmin} />
      </main>
    </div>
  );
}
