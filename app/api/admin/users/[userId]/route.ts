import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";
import { ensureJapaneseWritingHistoryTable } from "@/lib/japanese-writing-history";

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
function parseJapaneseLevel(input: unknown): "N1" | "N2" | "N3" | "N4" | "N5" | null {
  const v = String(input ?? "").trim().toUpperCase();
  if (v === "N1" || v === "N2" || v === "N3" || v === "N4" || v === "N5") return v;
  return null;
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
    await ensureJapaneseWritingHistoryTable();

    const { userId } = await params;
    const uid = toInt(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const username = normalizeUsername(body?.username);
    const displayName = normalizeDisplayName(body?.displayName);
    const password = normalizePassword(body?.password);
    const japaneseLevel = parseJapaneseLevel(body?.japaneseLevel);

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

    if (!japaneseLevel) {
      return NextResponse.json(
        { error: "일본어 등급(N1~N5)을 선택해주세요." },
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

    // ✅ 핵심: password가 있으면 hash, 없으면 null → COALESCE로 기존 유지
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const rows = await sql<{
      id: number;
      username: string;
      display_name: string;
      japanese_level: "N1" | "N2" | "N3" | "N4" | "N5";
    }>`
      UPDATE public.users
      SET username = ${username},
          display_name = ${displayName},
          japanese_level = ${japaneseLevel},
          password_hash = COALESCE(${passwordHash}, password_hash)
      WHERE id = ${uid}
      RETURNING id, username, display_name, japanese_level
    `;

    if (!rows[0]) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: rows[0].id,
        username: rows[0].username,
        display_name: rows[0].display_name,
        japanese_level: rows[0].japanese_level,
      },
    });
  } catch (e) {
    console.error("Admin update user error:", e);
    return NextResponse.json(
      { error: "유저 수정 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
