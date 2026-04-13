import { redirect } from "next/navigation";
import DashboardHeader from "@/components/dashboard-header";
import AdminUserCreateForm from "@/components/admin-user-create-form";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminUserNewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.user_role !== "ADMIN") redirect("/");

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-xl space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="admin-badge">Admin</span>
            </div>
            <h1 className="page-title">유저 등록</h1>
            <p className="page-subtitle">
              관리자가 계정을 생성합니다. (기본 역할: USER)
            </p>
          </div>
          <AdminUserCreateForm />
        </div>
      </main>
    </div>
  );
}
