import { sql } from "@/lib/db";

export type CourseRow = {
  id: number;
  name: string;
  slug: string;
  is_public: boolean;
};

export async function hasCourseVisibilityColumn() {
  const rows = await sql<{ ok: boolean }>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'courses'
        AND column_name = 'is_public'
    ) AS ok
  `;
  return rows[0]?.ok === true;
}

export async function listCourses(opts?: { includePrivate?: boolean }) {
  const includePrivate = opts?.includePrivate === true;
  const hasVisibility = await hasCourseVisibilityColumn();

  if (!hasVisibility) {
    const rows = await sql<{ id: number; name: string; slug: string }>`
      SELECT id, name, slug
      FROM public.courses
      ORDER BY id ASC
    `;
    return rows.map((r) => ({ ...r, is_public: true })) satisfies CourseRow[];
  }

  if (includePrivate) {
    return await sql<CourseRow>`
      SELECT id, name, slug, is_public
      FROM public.courses
      ORDER BY id ASC
    `;
  }

  return await sql<CourseRow>`
    SELECT id, name, slug, is_public
    FROM public.courses
    WHERE is_public = TRUE
    ORDER BY id ASC
  `;
}
