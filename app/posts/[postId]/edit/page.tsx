// app/posts/[postId]/edit/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

import DashboardHeader from "@/components/dashboard-header";
import EditClient from "./edit-client";
import type { Course, Difficulty } from "@/components/post-editor";

type DbDifficulty = "easy" | "medium" | "hard" | "project" | null;
type ParamsShape = { postId?: string };

type PostRow = {
  id: number;
  title: string;
  content: string | null;
  course_id: number;
  difficulty: DbDifficulty;
};

function toEditorDifficulty(d: DbDifficulty): Difficulty {
  if (d === "medium") return "medium";
  if (d === "project" || d === "hard") return "project";
  return "easy";
}

export default async function EditPostPage({
  params,
}: {
  params: ParamsShape | Promise<ParamsShape>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.user_role !== "ADMIN") redirect("/posts");

  // ✅ params Promise unwrap
  const p: ParamsShape = params ? await params : {};
  const postId = Number.parseInt(String(p?.postId ?? ""), 10);
  if (!Number.isFinite(postId) || postId <= 0) redirect("/posts");

  const courses = await sql<Course>`
    SELECT id, name, slug
    FROM public.courses
    ORDER BY name
  `;

  const rows = await sql<PostRow>`
    SELECT id, title, content, course_id, difficulty
    FROM public.posts
    WHERE id = ${postId}
    LIMIT 1
  `;
  const post = rows?.[0];
  if (!post) redirect("/posts");

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold">글 수정</h1>

        {/* ✅ 함수는 EditClient(클라이언트) 안에서만 선언 */}
        <EditClient
          postId={postId}
          courses={courses}
          initial={{
            title: post.title ?? "",
            content: post.content ?? "",
            courseId: post.course_id,
            difficulty: toEditorDifficulty(post.difficulty),
          }}
        />
      </main>
    </div>
  );
}
