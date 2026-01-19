import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

import DashboardHeader from "@/components/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import UserCourseProgress from "@/components/admin/user-detail/user-course-progress";
import UserRecentTimeline from "@/components/admin/user-detail/user-recent-timeline";
import UserAlerts from "@/components/admin/user-detail/user-alerts";
import UserAdminNotes from "@/components/admin/user-detail/user-admin-notes";

function toInt(v: any) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : NaN;
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.user_role !== "ADMIN") redirect("/");

  const { userId } = await params;
  const targetUserId = toInt(userId);
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) redirect("/");

  // 기본 유저 정보
  const userRows = await sql<{
    id: number;
    username: string;
    display_name: string;
    created_at: Date | null;
  }>`
    SELECT id, username, display_name, created_at
    FROM public.users
    WHERE id = ${targetUserId}
    LIMIT 1
  `;
  const user = userRows[0];
  if (!user) redirect("/");

  // 마지막 활동(퀴즈/제출물 기준)
  const last = await sql<{ last_at: Date | null }>`
    SELECT GREATEST(
      (SELECT MAX(created_at) FROM public.quiz_attempts WHERE user_id=${targetUserId}),
      (SELECT MAX(created_at) FROM public.submissions WHERE user_id=${targetUserId})
    ) AS last_at
  `;
  const lastAt = last[0]?.last_at ?? null;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={me} />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost" className="pl-0">
            <Link href="/admin/progress">← 전체 유저 진척도로</Link>
          </Button>
        </div>

        {/* 1) 상단 요약 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">유저 상세</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">{user.display_name}</Badge>
            <Badge variant="outline">@{user.username}</Badge>
            <div className="text-sm text-muted-foreground">
              가입일:{" "}
              {user.created_at
                ? new Date(user.created_at).toLocaleString()
                : "-"}
            </div>
            <div className="text-sm text-muted-foreground">
              마지막 활동: {lastAt ? new Date(lastAt).toLocaleString() : "-"}
            </div>
          </CardContent>
        </Card>

        {/* 2) 과목별 진행 현황 (접어서 보기) */}
        <UserCourseProgress userId={targetUserId} />

        {/* 3) 최근 타임라인 (최근 N개) */}
        <UserRecentTimeline userId={targetUserId} />

        {/* 4) 문제 지점(경고) */}
        <UserAlerts userId={targetUserId} />

        {/* 5) 관리자 메모 */}
        <UserAdminNotes targetUserId={targetUserId} adminId={me.id} />
      </main>
    </div>
  );
}
