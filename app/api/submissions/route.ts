// app/api/submissions/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

type Body = {
  lessonId: number;
  uploadIds: number[]; // uploads 테이블 id들
  attemptId?: number | null;
  note?: string | null;
};

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<Body>;

  const lessonId = Number(body.lessonId ?? NaN);
  const uploadIds = Array.isArray(body.uploadIds)
    ? body.uploadIds.map((n) => Number(n))
    : [];
  const attemptId = body.attemptId == null ? null : Number(body.attemptId);
  const note = typeof body.note === "string" ? body.note : null;

  if (!Number.isFinite(lessonId) || lessonId <= 0) {
    return NextResponse.json({ message: "Invalid lessonId" }, { status: 400 });
  }
  if (uploadIds.length === 0) {
    return NextResponse.json(
      { message: "At least 1 upload required" },
      { status: 400 }
    );
  }
  if (uploadIds.some((x) => !Number.isFinite(x) || x <= 0)) {
    return NextResponse.json({ message: "Invalid uploadIds" }, { status: 400 });
  }
  if (attemptId !== null && (!Number.isFinite(attemptId) || attemptId <= 0)) {
    return NextResponse.json({ message: "Invalid attemptId" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // lesson 확인
    const lessonRes = await client.query(
      `SELECT id FROM public.posts WHERE id=$1 AND type='lesson' LIMIT 1`,
      [lessonId]
    );
    if (lessonRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "Lesson not found" },
        { status: 404 }
      );
    }

    // lesson_sets에서 quiz_post_id 추적(없을 수도 있음)
    const setRes = await client.query(
      `SELECT quiz_post_id FROM public.lesson_sets WHERE lesson_id=$1 LIMIT 1`,
      [lessonId]
    );
    const quizPostId: number | null = setRes.rows[0]?.quiz_post_id ?? null;

    // uploadId들이 실제 존재하는지 확인
    const upRes = await client.query(
      `SELECT id FROM public.uploads WHERE id = ANY($1::bigint[])`,
      [uploadIds]
    );
    if (upRes.rows.length !== uploadIds.length) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "Some uploadIds not found" },
        { status: 400 }
      );
    }

    // attemptId가 있으면 소유자 검증(본인 attempt만 연결 가능)
    if (attemptId !== null) {
      const aRes = await client.query(
        `SELECT id FROM public.quiz_attempts WHERE id=$1 AND user_id=$2 LIMIT 1`,
        [attemptId, user.id]
      );
      if (aRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { message: "Invalid attemptId for this user" },
          { status: 400 }
        );
      }
    }

    const subRes = await client.query<{ id: number }>(
      `
      INSERT INTO public.submissions (user_id, lesson_id, quiz_post_id, attempt_id, note)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
      `,
      [user.id, lessonId, quizPostId, attemptId, note]
    );
    const submissionId = subRes.rows[0].id;

    for (const uploadId of uploadIds) {
      await client.query(
        `
        INSERT INTO public.submission_files (submission_id, upload_id)
        VALUES ($1, $2)
        `,
        [submissionId, uploadId]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, submissionId });
  } catch (e: any) {
    await client.query("ROLLBACK");
    return NextResponse.json(
      { message: e?.message ?? "Submit failed" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
