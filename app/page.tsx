import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

import DashboardHeader from "@/components/dashboard-header";
import { CourseCards } from "@/components/course-cards";
import AdminUsersProgressOverview from "@/components/admin-users-progress-overview";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin = user.user_role === "ADMIN";
  const displayName =
    (user.display_name ?? "").trim() || (user.username ?? "").trim();

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <main className="container mx-auto px-4 py-8 space-y-10">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            안녕하세요, {displayName}님
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? "관리자 대시보드에 오신 것을 환영합니다."
              : "오늘도 학습을 이어가세요."}
          </p>
        </div>

        {/* Course cards */}
        <CourseCards userId={user.id} userRole={user.user_role} />

        {/* Admin: user progress overview */}
        {isAdmin && (
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="admin-badge">Admin</span>
              전체 학습 현황
            </h2>
            <AdminUsersProgressOverview />
          </section>
        )}
      </main>
    </div>
  );
}
