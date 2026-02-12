import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

import DashboardHeader from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import AdminUserEditForm from "@/components/admin/admin-user-edit-form";
import AdminUserListWithDelete from "@/components/admin/admin-user-list-with-delete";
import AdminCourseCategoryManager from "@/components/admin/admin-course-category-manager";

function toInt(v: any) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : NaN;
}

export default async function AdminUserEditPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.user_role !== "ADMIN") redirect("/");

  const { userId } = await params;
  const uid = toInt(userId);
  if (!Number.isFinite(uid) || uid <= 0) redirect("/admin/progress");

  const rows = await sql<{
    id: number;
    username: string;
    display_name: string | null;
  }>`
    SELECT id, username, display_name
    FROM public.users
    WHERE id = ${uid}
    LIMIT 1
  `;
  const user = rows[0];
  if (!user) redirect("/admin/progress");

  const users = await sql<{
    id: number;
    username: string;
    display_name: string | null;
    user_role: "USER" | "ADMIN";
  }>`
    SELECT id, username, display_name, user_role
    FROM public.users
    ORDER BY id ASC
  `;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={me} />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost" className="pl-0">
            <Link href="/admin/progress" className="cursor-pointer">
              ← 전체 유저 진척도
            </Link>
          </Button>
        </div>

        <div className="max-w-2xl space-y-4">
          <div>
            <h1 className="text-2xl font-bold">유저 수정</h1>
            <p className="text-muted-foreground text-sm mt-1">
              아이디/표시 이름/비밀번호 변경 가능
            </p>
          </div>

          <AdminUserEditForm
            userId={user.id}
            initialUsername={user.username}
            initialDisplayName={user.display_name ?? ""}
          />

          {/* ✅ 요청: 수정란 바로 아래에 유저 삭제도 가능한 목록 */}
          <AdminUserListWithDelete
            users={users}
            currentEditUserId={uid}
            myUserId={me.id}
          />

          <AdminCourseCategoryManager />
        </div>
      </main>
    </div>
  );
}
