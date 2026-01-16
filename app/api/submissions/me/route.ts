import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const lessonId = Number(searchParams.get("lessonId") ?? NaN);
  if (!Number.isFinite(lessonId) || lessonId <= 0) {
    return NextResponse.json({ message: "Invalid lessonId" }, { status: 400 });
  }

  try {
    const rows = await sql<any>`
      SELECT
        s.id,
        s.lesson_id,
        s.quiz_post_id,
        s.attempt_id,
        s.note,
        s.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'uploadId', u.id,
              'filename', u.filename,
              'mime', u.mime,
              'size', u.size,
              'downloadUrl', CONCAT('/api/upload/', u.id)
            )
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'::json
        ) AS files
      FROM public.submissions s
      LEFT JOIN public.submission_files sf ON sf.submission_id = s.id
      LEFT JOIN public.uploads u ON u.id = sf.upload_id
      WHERE s.user_id = ${user.id} AND s.lesson_id = ${lessonId}
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `;

    return NextResponse.json({ ok: true, submissions: rows });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Fetch failed" },
      { status: 500 }
    );
  }
}
