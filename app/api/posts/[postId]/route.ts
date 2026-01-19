// app/api/posts/[postId]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sql, pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type Ctx = { params: { postId: string } | Promise<{ postId: string }> };

function parseId(raw: string) {
  const id = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

async function getPostId(ctx: Ctx) {
  const p = await ctx.params;
  return parseId(p.postId);
}

async function deleteAttachments(client: any, postId: number) {
  await client.query(`DELETE FROM public.post_attachments WHERE post_id=$1`, [
    postId,
  ]);
}

async function deleteQuizQuestions(client: any, quizPostId: number) {
  await client.query(`DELETE FROM public.quiz_questions WHERE post_id=$1`, [
    quizPostId,
  ]);
}

async function deletePostRow(client: any, postId: number) {
  await client.query(`DELETE FROM public.posts WHERE id=$1`, [postId]);
}

// ✅ 수정 (PUT)
export async function PUT(req: Request, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (user.user_role !== "ADMIN")
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = await getPostId(ctx);
    if (!id)
      return NextResponse.json({ message: "Invalid postId" }, { status: 400 });

    const body = await req.json().catch(() => ({}) as any);

    const title = String(body.title ?? "").trim();
    const content = String(body.content ?? "");
    const difficulty = (body.difficulty ?? null) as
      | "easy"
      | "medium"
      | "hard"
      | "project"
      | null;

    const courseIdRaw = Number(body.courseId ?? NaN);
    const courseId =
      Number.isFinite(courseIdRaw) && courseIdRaw > 0 ? courseIdRaw : null;

    if (!title)
      return NextResponse.json(
        { message: "title is required" },
        { status: 400 },
      );

    const rows = await sql<{ id: number }>`
      UPDATE public.posts
      SET title = ${title},
          content = ${content},
          difficulty = ${difficulty},
          course_id = COALESCE(${courseId}, course_id)
      WHERE id = ${id}
      RETURNING id
    `;

    return NextResponse.json({ ok: true, id: rows?.[0]?.id ?? id });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "PUT failed" },
      { status: 500 },
    );
  }
}

// ✅ 삭제 (DELETE) - lesson이면 연결된 reference/quiz까지 같이 삭제
export async function DELETE(_: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (user.user_role !== "ADMIN")
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const id = await getPostId(ctx);
  if (!id)
    return NextResponse.json({ message: "Invalid postId" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) 대상 post 타입 확인
    const postRow = (
      await client.query<{ id: number; type: string }>(
        `SELECT id, type FROM public.posts WHERE id=$1 LIMIT 1`,
        [id],
      )
    ).rows[0];

    if (!postRow) {
      await client.query("ROLLBACK");
      return NextResponse.json({ message: "Post not found" }, { status: 404 });
    }

    const type = postRow.type;

    // 2) lesson이면 lesson_sets에서 연결된 reference/quiz 찾아서 같이 삭제
    if (type === "lesson") {
      const setRow = (
        await client.query<{
          reference_post_id: number | null;
          quiz_post_id: number | null;
        }>(
          `SELECT reference_post_id, quiz_post_id
           FROM public.lesson_sets
           WHERE lesson_id=$1
           LIMIT 1`,
          [id],
        )
      ).rows[0];

      const refId = setRow?.reference_post_id ?? null;
      const quizId = setRow?.quiz_post_id ?? null;

      // (a) lesson_sets 먼저 제거
      await client.query(`DELETE FROM public.lesson_sets WHERE lesson_id=$1`, [
        id,
      ]);

      // (b) reference 삭제 (첨부 먼저 삭제)
      if (refId) {
        await deleteAttachments(client, refId);
        await client.query(
          `DELETE FROM public.posts WHERE id=$1 AND type='reference'`,
          [refId],
        );
      }

      // (c) quiz 삭제 (문항 + 첨부 먼저 삭제)
      if (quizId) {
        await deleteQuizQuestions(client, quizId);
        await deleteAttachments(client, quizId);
        await client.query(
          `DELETE FROM public.posts WHERE id=$1 AND type='quiz'`,
          [quizId],
        );
      }

      // (d) lesson 첨부 삭제 후 lesson 삭제
      await deleteAttachments(client, id);
      await client.query(
        `DELETE FROM public.posts WHERE id=$1 AND type='lesson'`,
        [id],
      );
    } else if (type === "quiz") {
      // quiz 단독 삭제
      await deleteQuizQuestions(client, id);
      await deleteAttachments(client, id);
      await deletePostRow(client, id);
    } else {
      // reference/기타 단독 삭제
      await deleteAttachments(client, id);
      await deletePostRow(client, id);
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await client.query("ROLLBACK");
    return NextResponse.json(
      { message: e?.message ?? "DELETE failed" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
