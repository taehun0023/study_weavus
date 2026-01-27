import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

function toInt(v: any) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : NaN;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }, // ✅ Promise로
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params; // ✅ await
  const interviewId = toInt(id);

  if (!Number.isFinite(interviewId) || interviewId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const rows = await sql<any>`
    SELECT *
    FROM public.interviews
    WHERE id = ${interviewId}
    LIMIT 1
  `;

  const interview = rows[0];
  if (!interview) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ interview });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }, // ✅ Promise로
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.user_role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params; // ✅ await
  const interviewId = toInt(id);

  if (!Number.isFinite(interviewId) || interviewId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));

  const title = String(body?.title ?? "").trim();
  const content = body?.content ?? null;

  const rows = await sql<any>`
    UPDATE public.interviews
    SET
      title = COALESCE(NULLIF(${title}, ''), title),
      content = COALESCE(${content}, content),
      updated_at = NOW()
    WHERE id = ${interviewId}
    RETURNING *
  `;

  const interview = rows[0];
  if (!interview) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ interview });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }, // ✅ Promise로
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.user_role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params; // ✅ await
  const interviewId = toInt(id);

  if (!Number.isFinite(interviewId) || interviewId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await sql`DELETE FROM public.interviews WHERE id = ${interviewId}`;
  return NextResponse.json({ ok: true });
}
