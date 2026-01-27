import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

function toInt(v: any) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeUsername(v: any) {
  return String(v ?? "").trim();
}

function normalizeDisplayName(v: any) {
  return String(v ?? "").trim();
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const me = await getCurrentUser();
    if (!me || me.user_role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;
    const uid = toInt(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const username = normalizeUsername(body?.username);
    const displayName = normalizeDisplayName(body?.displayName);

    if (!username) {
      return NextResponse.json(
        { error: "아이디를 입력해주세요." },
        { status: 400 },
      );
    }
    if (username.length < 2 || username.length > 30) {
      return NextResponse.json(
        { error: "아이디는 2~30자여야 합니다." },
        { status: 400 },
      );
    }

    const dup = await sql<{ id: number }>`
      SELECT id
      FROM public.users
      WHERE username = ${username} AND id <> ${uid}
      LIMIT 1
    `;
    if (dup.length > 0) {
      return NextResponse.json(
        { error: "이미 사용 중인 아이디입니다." },
        { status: 400 },
      );
    }

    const rows = await sql<{
      id: number;
      username: string;
      display_name: string;
    }>`
      UPDATE public.users
      SET username = ${username},
          display_name = ${displayName}
      WHERE id = ${uid}
      RETURNING id, username, display_name
    `;

    if (!rows[0]) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ user: rows[0] });
  } catch (e) {
    console.error("Admin update user error:", e);
    return NextResponse.json(
      { error: "유저 수정 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const me = await getCurrentUser();
    if (!me || me.user_role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;
    const uid = toInt(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    if (uid === me.id) {
      return NextResponse.json(
        { error: "자기 자신은 삭제할 수 없습니다." },
        { status: 400 },
      );
    }

    await sql`DELETE FROM public.sessions WHERE user_id = ${uid}`;
    await sql`DELETE FROM public.users WHERE id = ${uid}`;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Admin delete user error:", e);
    return NextResponse.json(
      { error: "유저 삭제 중 오류가 발생했습니다. (연관 데이터 FK 확인 필요)" },
      { status: 500 },
    );
  }
}
