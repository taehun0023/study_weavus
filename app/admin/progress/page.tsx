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
      <main className="container mx-auto px-4 py-8">
        <AdminUsersProgressOverview />
      </main>
    </div>
  );
}
