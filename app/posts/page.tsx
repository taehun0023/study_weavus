// app/posts/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listCourses } from "@/lib/courses";

import DashboardHeader from "@/components/dashboard-header";
import { PostsFilter } from "@/components/posts-filter";
import { PostsList } from "@/components/posts-list";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PostsPageProps {
  searchParams: Promise<{
    course?: string;
    difficulty?: string;
  }>;
}

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  const courseSlug = (params.course ?? "java").toLowerCase();
  const difficulty = (params.difficulty ?? "all").toLowerCase();

  const courses = await listCourses({
    includePrivate: user.user_role === "ADMIN",
  });

  const selected =
    courses.find((c) => c.slug.toLowerCase() === courseSlug) ?? courses[0];

  if (!selected) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader user={user} />
        <main className="container mx-auto px-4 py-8">
          <div className="rounded-xl border border-border/60 bg-card px-5 py-4 text-sm text-muted-foreground">
            등록된 과목이 없습니다.
          </div>
        </main>
      </div>
    );
  }

  const isAdmin = user.user_role === "ADMIN";

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <main className="container mx-auto px-4 py-8 space-y-5">
        {/* Page heading */}
        <div>
          <h1 className="page-title">수업 목록</h1>
          <p className="page-subtitle">{selected.name} 과목의 수업을 확인하세요.</p>
        </div>

        {/* Filters */}
        <PostsFilter
          courses={courses}
          selectedCourseSlug={selected.slug}
          selectedDifficulty={difficulty}
        />

        {/* List */}
        <PostsList
          courseId={selected.id}
          courseSlug={selected.slug}
          difficulty={difficulty}
          isAdmin={isAdmin}
        />
      </main>
    </div>
  );
}
