import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const isAdmin = user.user_role === "ADMIN";

  const { searchParams } = new URL(req.url);
  const lessonId = Number(searchParams.get("lessonId") ?? NaN);
  if (!Number.isFinite(lessonId) || lessonId <= 0) {
    return NextResponse.json({ message: "Invalid lessonId" }, { status: 400 });
  }

  try {
    const rows = await sql<any>`
      SELECT
        s.id,
        s.user_id,
        usr.username,
        s.lesson_id,
        s.quiz_post_id,
        s.attempt_id,
        s.note,
        s.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'uploadId', up.id,
              'filename', up.filename,
              'mime', up.mime,
              'size', up.size,
              'downloadUrl', CONCAT('/api/upload/', up.id)
            )
          ) FILTER (WHERE up.id IS NOT NULL),
          '[]'::json
        ) AS files
      FROM public.submissions s
      JOIN public.users usr ON usr.id = s.user_id
      LEFT JOIN public.submission_files sf ON sf.submission_id = s.id
      LEFT JOIN public.uploads up ON up.id = sf.upload_id
      WHERE s.lesson_id = ${lessonId}
        AND (${isAdmin} OR s.user_id = ${user.id})
      GROUP BY s.id, s.user_id, usr.username
      ORDER BY s.created_at DESC
    `;

    return NextResponse.json({
      ok: true,
      submissions: rows,
      viewer: { id: user.id, isAdmin },
    });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Fetch failed" },
      { status: 500 }
    );
  }
}
