// app/admin/progress/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import DashboardHeader from "@/components/dashboard-header";
import AdminUsersProgressOverview from "@/components/admin-users-progress-overview";

export default async function AdminProgressPage() {
  const user = await getCurrentUser();
  if (!user || user.user_role !== "ADMIN") redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-6 md:py-8">
        <section className="mb-6 rounded-2xl border border-border/60 bg-card/50 p-5 backdrop-blur-sm md:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Admin Dashboard
              </p>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                학습 진도 관리
              </h1>
              <p className="text-sm text-muted-foreground">
                사용자별 진도, 학습 성과, 누락 구간을 빠르게 확인하고 대응할 수
                있습니다.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/70 p-3 md:p-4">
          <AdminUsersProgressOverview />
        </section>
      </main>
    </div>
  );
}
