// app/admin/submissions/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import DashboardHeader from "@/components/dashboard-header";
import AdminSubmissionsClient from "./AdminSubmissionsClient";

export default async function AdminSubmissionsPage() {
  const user = await getCurrentUser();
  if (!user || user.user_role !== "ADMIN") redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-8 space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="admin-badge">Admin</span>
          </div>
          <h1 className="page-title">제출물 관리</h1>
          <p className="page-subtitle">학생들이 제출한 파일을 확인합니다.</p>
        </div>
        <AdminSubmissionsClient />
      </main>
    </div>
  );
}
