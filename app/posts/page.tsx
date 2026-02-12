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

  // ✅ Next 16: Promise로 들어오는 searchParams를 먼저 풀어야 함
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
          <div className="text-sm text-muted-foreground">
            courses 데이터가 없습니다.
          </div>
        </main>
      </div>
    );
  }

  const isAdmin = user.user_role === "ADMIN";

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <main className="container mx-auto space-y-6 px-4 py-8">
        <div className="text-2xl font-bold">게시글 목록</div>

        <PostsFilter
          courses={courses}
          selectedCourseSlug={selected.slug}
          selectedDifficulty={difficulty}
        />

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
