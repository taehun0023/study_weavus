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

    // ✅ 스키마 + 테이블을 명시적으로 고정 (정답)
    const rows = await sql<UserRow>`
      SELECT id, username, password_hash, display_name, role, created_at
      FROM public.users
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

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      return NextResponse.json(
        { ok: false, message: "Invalid credentials" },
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
