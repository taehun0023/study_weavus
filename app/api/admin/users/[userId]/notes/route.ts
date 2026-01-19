import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

function toInt(v: any) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : NaN;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.user_role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const uid = toInt(userId);

  const notes = await sql<{
    id: number;
    content: string;
    created_at: Date;
    updated_at: Date;
    admin_id: number;
  }>`
    SELECT id, content, created_at, updated_at, admin_id
    FROM public.admin_user_notes
    WHERE user_id=${uid}
    ORDER BY created_at DESC
    LIMIT 50
  `;

  return NextResponse.json({ notes });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.user_role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const uid = toInt(userId);

  const body = await req.json().catch(() => ({}));
  const content = String(body?.content ?? "").trim();
  if (!content)
    return NextResponse.json({ error: "content required" }, { status: 400 });

  const row = await sql<{ id: number }>`
    INSERT INTO public.admin_user_notes (user_id, admin_id, content)
    VALUES (${uid}, ${me.id}, ${content})
    RETURNING id
  `;

  return NextResponse.json({ id: row[0]?.id });
}
