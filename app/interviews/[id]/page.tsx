export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import InterviewPages from "@/components/interview_pages";
import TechStackInterviewQA from "@/components/TechStackInterviewQA";
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

  const p = (params as any)?.then
    ? await (params as Promise<{ id: string }>)
    : (params as any);
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

  // ✅ "기술 질문" 글이면 기술 QA를 보여주기
  const isTech = row.title?.includes("기술"); // 필요시 row.title === "기술 질문" 로 변경

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

            {/* ✅ 공통/기술 질문 컴포넌트 분기 */}
            <div className="container mx-auto px-4 py-6">
              {isTech ? <TechStackInterviewQA /> : <InterviewPages />}
            </div>
          </CardHeader>
        </Card>
      </main>
    </div>
  );
}
