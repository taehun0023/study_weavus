import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";

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
function normalizePassword(v: any) {
  const s = String(v ?? "");
  return s.length ? s : "";
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
    const password = normalizePassword(body?.password);

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

    // ✅ 비밀번호 규칙(입력된 경우만)
    if (password) {
      if (password.length < 4 || password.length > 72) {
        return NextResponse.json(
          { error: "비밀번호는 4~72자여야 합니다." },
          { status: 400 },
        );
      }
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

    // ✅ 핵심: password가 있으면 hash, 없으면 null → COALESCE로 기존 유지
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const rows = await sql<{
      id: number;
      username: string;
      display_name: string;
    }>`
      UPDATE public.users
      SET username = ${username},
          display_name = ${displayName},
          password_hash = COALESCE(${passwordHash}, password_hash)
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
