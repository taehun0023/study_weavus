// app/api/auth/login/route.ts
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { sql, type User } from "@/lib/db"

export const runtime = "nodejs"

type LoginBody = {
  username: string
  password: string
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<LoginBody>

    const username = (body.username ?? "").trim()
    const password = body.password ?? ""

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, message: "username/password required" },
        { status: 400 }
      )
    }

    // ✅ DB 조회
    const rows = await sql<User>`
      SELECT id, username, password_hash, display_name, role, created_at
      FROM users
      WHERE username = ${username}
      LIMIT 1
    `
    const user = rows[0]

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Invalid credentials" },
        { status: 401 }
      )
    }

    // ✅ 비밀번호 검증
    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      return NextResponse.json(
        { ok: false, message: "Invalid credentials" },
        { status: 401 }
      )
    }

    // ✅ 성공 응답(세션/토큰은 너 프로젝트 방식에 맞게 추가)
    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        created_at: user.created_at,
      },
    })
  } catch (e: any) {
    // ✅ 여기서 500의 진짜 원인을 응답/로그로 확인 가능
    console.error("[LOGIN_ERROR]", e)

    return NextResponse.json(
      {
        ok: false,
        message: e?.message ?? "Internal Server Error",
        // 아래 2개는 pg에서만 주로 존재하지만 혹시 있으면 같이 보여줌
        code: e?.code,
        detail: e?.detail,
      },
      { status: 500 }
    )
  }
}
