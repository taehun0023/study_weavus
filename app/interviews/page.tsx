export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDateOnly } from "@/lib/datetime";
import DashboardHeader from "@/components/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type InterviewRow = {
  id: number;
  title: string;
  created_at: string;
  created_by: string | null;
};

export default async function InterviewsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await sql<InterviewRow>`
    SELECT id, title, created_at, created_by
    FROM public.interviews
    ORDER BY created_at DESC
  `.catch(async () => {
    // 테이블이 아직 없을 때도 목록 페이지가 깨지지 않게
    return [] as InterviewRow[];
  });

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold">면접</h1>
          {user.user_role === "ADMIN" && (
            <Button asChild variant="secondary">
              {/* ✅ 면접 글작성은 기존 세트 작성 페이지를 그대로 사용 */}
              <Link href="/posts/new?course=interview">면접 글작성</Link>
            </Button>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            아직 면접 글이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {rows.map((r) => (
              <Link key={r.id} href={`/interviews/${r.id}`} className="block">
                <Card className="border-border bg-card hover:border-white/20 transition">
                  <CardHeader>
                    <CardTitle className="text-base">{r.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground flex items-center justify-between">
                    <span>{formatDateOnly(r.created_at)}</span>
                    <span className="truncate max-w-[50%] text-right">
                      {r.created_by ? `작성자: ${r.created_by}` : ""}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
