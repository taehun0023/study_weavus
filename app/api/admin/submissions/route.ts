// app/api/admin/submissions/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (user.user_role !== "ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    /**
     * ⚠️ 테이블/컬럼명은 프로젝트마다 다를 수 있어.
     * 아래는 가장 일반적인 형태:
     * - submissions: id, user_id, lesson_id, created_at
     * - submission_files: submission_id, upload_id
     * - uploads: id, filename
     * - users: id, username
     * - posts(lesson): id, title
     */
    const rows = await sql<{
      submission_id: number;
      username: string;
      lesson_id: number;
      lesson_title: string;
      created_at: string;
      upload_id: number | null;
      filename: string | null;
    }>`
      SELECT
        s.id as submission_id,
        u.username as username,
        s.lesson_id as lesson_id,
        p.title as lesson_title,
        s.created_at as created_at,
        sf.upload_id as upload_id,
        up.filename as filename
      FROM public.submissions s
      JOIN public.users u ON u.id = s.user_id
      JOIN public.posts p ON p.id = s.lesson_id
      LEFT JOIN public.submission_files sf ON sf.submission_id = s.id
      LEFT JOIN public.uploads up ON up.id = sf.upload_id
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT 200
    `;

    // submission_id 기준으로 파일 묶기
    const map = new Map<
      number,
      {
        submissionId: number;
        username: string;
        lessonId: number;
        lessonTitle: string;
        createdAt: string;
        files: { uploadId: number; filename: string; url: string }[];
      }
    >();

    for (const r of rows) {
      const key = r.submission_id;
      if (!map.has(key)) {
        map.set(key, {
          submissionId: r.submission_id,
          username: r.username,
          lessonId: r.lesson_id,
          lessonTitle: r.lesson_title,
          createdAt: r.created_at,
          files: [],
        });
      }
      if (r.upload_id && r.filename) {
        map.get(key)!.files.push({
          uploadId: r.upload_id,
          filename: r.filename,
          url: `/api/upload/${r.upload_id}`,
        });
      }
    }

    return NextResponse.json(Array.from(map.values()));
  } catch (e: any) {
    // ✅ 무조건 JSON으로 에러 반환
    return NextResponse.json(
      { message: e?.message ?? "Failed to load submissions" },
      { status: 500 }
    );
  }
}
