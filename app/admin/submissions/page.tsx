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
      <main className="container mx-auto px-4 py-8">
        <AdminSubmissionsClient />
      </main>
    </div>
  );
}
