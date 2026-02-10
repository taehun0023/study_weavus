// app/api/submissions/[submissionId]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

type Ctx = {
  params: { submissionId: string } | Promise<{ submissionId: string }>;
};

function parseId(raw: string) {
  const id = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

async function getSubmissionId(ctx: Ctx) {
  const p = await ctx.params;
  return parseId(p.submissionId);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const submissionId = await getSubmissionId(ctx);
  if (!submissionId)
    return NextResponse.json(
      { message: "Invalid submissionId" },
      { status: 400 },
    );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const row = await client.query<{ user_id: number }>(
      `SELECT user_id FROM public.submissions WHERE id=$1 LIMIT 1`,
      [submissionId],
    );
    const ownerId = row.rows[0]?.user_id ?? null;
    if (!ownerId) {
      await client.query("ROLLBACK");
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    const isAdmin = user.user_role === "ADMIN";
    if (!isAdmin && ownerId !== user.id) {
      await client.query("ROLLBACK");
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    await client.query(
      `DELETE FROM public.submission_files WHERE submission_id=$1`,
      [submissionId],
    );
    await client.query(`DELETE FROM public.submissions WHERE id=$1`, [
      submissionId,
    ]);

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await client.query("ROLLBACK");
    return NextResponse.json(
      { message: e?.message ?? "Delete failed" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
