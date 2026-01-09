// app/api/auth/login/route.ts
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { sql } from "@/lib/db"

export const runtime = "nodejs"

type LoginBody = {
  username: string
  password: string
}

type UserRow = {
  id: number
  username: string
  password_hash: string
  display_name: string
  role: "USER" | "ADMIN"
  created_at: Date
}

function isBcryptHash(v: string) {
  // bcryptjs 해시는 보통 $2a$ / $2b$ / $2y$ 로 시작
  return typeof v === "string" && /^\$2[aby]\$\d{2}\$/.test(v)
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

    const rows = await sql<UserRow>`
      SELECT id, username, password_hash, display_name, role, created_at
      FROM public.users
      WHERE username = ${username}
      LIMIT 1
    `

    const user = rows[0]
    if (!user) {
      // ✅ username이 DB에 없음
      return NextResponse.json(
        { ok: false, message: "User not found" },
        { status: 401 }
      )
    }

    // ✅ password_hash가 bcrypt 형태가 아니면 compare가 무조건 실패
    if (!isBcryptHash(user.password_hash)) {
      console.error("[LOGIN_ERROR] password_hash is not bcrypt", {
        username: user.username,
        password_hash_preview: String(user.password_hash).slice(0, 12),
      })
      return NextResponse.json(
        {
          ok: false,
          message: "Password hash is not bcrypt (DB data issue)",
        },
        { status: 500 }
      )
    }

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      // ✅ 비밀번호 불일치
      return NextResponse.json(
        { ok: false, message: "Invalid password" },
        { status: 401 }
      )
    }

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
    console.error("[LOGIN_ERROR]", e)
    return NextResponse.json(
      { ok: false, message: e?.message ?? "Internal Server Error" },
      { status: 500 }
    )
  }
}
