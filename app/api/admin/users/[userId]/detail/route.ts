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
  if (!Number.isFinite(uid) || uid <= 0)
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });

  const user = await sql<{
    id: number;
    username: string;
    display_name: string;
  }>`
    SELECT id, username, display_name
    FROM public.users
    WHERE id=${uid}
    LIMIT 1
  `;
  if (!user[0])
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ user: user[0] });
}
