import PostCardClient from "@/components/post-card-client";
import { sql } from "@/lib/db";

type Difficulty = "easy" | "medium" | "hard" | "project" | null;
type PostType = "lesson" | "reference" | "quiz";

type Row = {
  id: number;
  title: string;
  difficulty: Difficulty;
  type: PostType;
  course_name: string;
  course_slug: string;
};

export async function PostsList({
  courseId,
  courseSlug,
  difficulty,
  isAdmin,
}: {
  courseId: number;
  courseSlug: string;
  difficulty: string; // all|easy|medium|project
  isAdmin: boolean;
}) {
  const returnHref =
    difficulty && difficulty !== "all"
      ? `/posts?course=${courseSlug}&difficulty=${difficulty}`
      : `/posts?course=${courseSlug}`;

  let rows: Row[] = [];

  // ✅ 목록에는 lesson만 보여주게(UX 일관)
  if (difficulty && difficulty !== "all") {
    const diffDb = difficulty === "project" ? "hard" : difficulty;

    rows = await sql<Row>`
      SELECT
        p.id,
        p.title,
        p.difficulty,
        p.type,
        c.name AS course_name,
        c.slug AS course_slug
      FROM public.posts p
      JOIN public.courses c ON c.id = p.course_id
      WHERE p.course_id = ${courseId}
        AND p.type = 'lesson'
        AND p.difficulty = ${diffDb}
      ORDER BY
  CASE
    WHEN p.title ~ '^[0-9]+' THEN (substring(p.title from '^[0-9]+'))::int
    ELSE 2147483647
  END ASC,
  p.title ASC,
  p.id DESC
      LIMIT 200
    `;
  } else {
    rows = await sql<Row>`
      SELECT
        p.id,
        p.title,
        p.difficulty,
        p.type,
        c.name AS course_name,
        c.slug AS course_slug
      FROM public.posts p
      JOIN public.courses c ON c.id = p.course_id
      WHERE p.course_id = ${courseId}
        AND p.type = 'lesson'
      ORDER BY
  CASE
    WHEN p.title ~ '^[0-9]+' THEN (substring(p.title from '^[0-9]+'))::int
    ELSE 2147483647
  END ASC,
  p.title ASC,
  p.id DESC
      LIMIT 200
    `;
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        게시글이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <PostCardClient
          key={r.id}
          postId={r.id}
          title={r.title}
          courseName={r.course_name}
          difficulty={r.difficulty}
          postType={r.type}
          isAdmin={isAdmin}
          returnHref={returnHref}
        />
      ))}
    </div>
  );
}
