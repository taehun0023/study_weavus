import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

import DashboardHeader from "@/components/dashboard-header";
import { CourseCards } from "@/components/course-cards";

// 관리자 전용
import AdminUsersProgressOverview from "@/components/admin-users-progress-overview";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin = user.user_role === "ADMIN";

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <main className="container mx-auto space-y-8 px-4 py-8">
        {/* 학습 과목 카드만 유지 */}
        <CourseCards userId={user.id} userRole={user.user_role} />

        {/* 관리자면 전체 유저 진행도만 */}
        {isAdmin ? <AdminUsersProgressOverview /> : null}
      </main>
    </div>
  );
}
