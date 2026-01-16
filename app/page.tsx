import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

import DashboardHeader from "@/components/dashboard-header";
import { CourseCards } from "@/components/course-cards";
import { RecentActivity } from "@/components/recent-activity";

// 유저 만점 그래프(있으면 유지)
import UserPerfectGraph from "@/components/user-perfect-graph";

// 관리자 전용
import AdminUsersPerfectGraphs from "@/components/admin-users-perfect-graphs";
import AdminUsersProgressOverview from "@/components/admin-users-progress-overview";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin = user.user_role === "ADMIN";

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <main className="container mx-auto space-y-8 px-4 py-8">
        {/* ✅ 삭제: 전체 학습 진척도(OverallProgress) */}

        {/* ✅ 유저 만점 그래프(유저에 만점 기록 있을 때만 표시되게 돼있음) */}
        <UserPerfectGraph />

        <CourseCards userId={user.id} />
        <RecentActivity userId={user.id} />

        {isAdmin ? (
          <>
            <AdminUsersPerfectGraphs />
            <AdminUsersProgressOverview />
          </>
        ) : null}
      </main>
    </div>
  );
}
