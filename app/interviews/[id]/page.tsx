export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import DashboardHeader from "@/components/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type InterviewRow = {
  id: number;
  title: string;
  content: string | null;
  created_at: string;
  created_by: string | null;
};

export default async function InterviewDetailPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const p = (params as any)?.then ? await (params as Promise<{ id: string }>) : (params as any);
  const id = Number.parseInt(String(p?.id ?? ""), 10);
  if (!Number.isFinite(id) || id <= 0) redirect("/interviews");

  const rows = await sql<InterviewRow>`
    SELECT id, title, content, created_at, created_by
    FROM public.interviews
    WHERE id = ${id}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) redirect("/interviews");

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">면접</h1>
          <Button asChild variant="outline">
            <Link href="/interviews">목록</Link>
          </Button>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-xl">{row.title}</CardTitle>
            <div className="text-sm text-muted-foreground">
              {new Date(row.created_at).toLocaleString()} {row.created_by ? `· ${row.created_by}` : ""}
            </div>
          </CardHeader>
          <CardContent className="prose prose-invert max-w-none">
            {/* 기존 게시글 상세처럼 HTML/마크업이 들어올 수 있으니 그대로 렌더 */}
            <div dangerouslySetInnerHTML={{ __html: row.content ?? "" }} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
