import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import DashboardHeader from "@/components/dashboard-header";
import AdminAssistantFaqClient from "./AdminAssistantFaqClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminAssistantPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.user_role !== "ADMIN") redirect("/");

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-8 space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="admin-badge">Admin</span>
          </div>
          <h1 className="page-title">AI 학습 데이터 관리</h1>
          <p className="page-subtitle">
            챗봇이 답변할 FAQ를 등록/수정/삭제합니다.
          </p>
        </div>
        <AdminAssistantFaqClient />
      </main>
    </div>
  );
}
