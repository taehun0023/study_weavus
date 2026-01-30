import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

function normalizeUsername(v: any) {
  const s = String(v ?? "").trim();
  return s;
}

function normalizeDisplayName(v: any) {
  return String(v ?? "").trim();
}

function normalizePassword(v: any) {
  return String(v ?? "");
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const username = normalizeUsername(body?.username);
    const displayName = normalizeDisplayName(body?.displayName);
    const password = normalizePassword(body?.password);
    const currentPassword = normalizePassword(body?.currentPassword);

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
      WHERE username = ${username} AND id <> ${me.id}
      LIMIT 1
    `;
    if (dup.length > 0) {
      return NextResponse.json(
        { error: "이미 사용 중인 아이디입니다." },
        { status: 400 },
      );
    }

    let nextHash: string | null = null;
    if (password) {
      if (password.length < 4 || password.length > 72) {
        return NextResponse.json(
          { error: "비밀번호는 4~72자여야 합니다." },
          { status: 400 },
        );
      }
      if (!currentPassword) {
        return NextResponse.json(
          { error: "현재 비밀번호를 입력해주세요." },
          { status: 400 },
        );
      }

      const rows = await sql<{ password_hash: string }>`
        SELECT password_hash
        FROM public.users
        WHERE id = ${me.id}
        LIMIT 1
      `;
      const stored = rows[0]?.password_hash;
      if (!stored) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const ok = await verifyPassword(currentPassword, stored);
      if (!ok) {
        return NextResponse.json(
          { error: "현재 비밀번호가 올바르지 않습니다." },
          { status: 400 },
        );
      }

      nextHash = await hashPassword(password);
    }

    const rows = await sql<{
      id: number;
      username: string;
      display_name: string;
    }>`
      UPDATE public.users
      SET username = ${username},
          display_name = ${displayName || me.display_name},
          password_hash = COALESCE(${nextHash}, password_hash)
      WHERE id = ${me.id}
      RETURNING id, username, display_name
    `;

    const u = rows[0];
    return NextResponse.json({
      user: {
        id: u.id,
        username: u.username,
        displayName: u.display_name,
      },
    });
  } catch (e) {
    console.error("Update my profile error:", e);
    return NextResponse.json(
      { error: "유저 정보 수정 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
