// app/api/auth/login/route.ts
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  verifyPassword,
  upgradePasswordHashIfNeeded,
  createSession,
  setSessionCookie,
} from "@/lib/auth"

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
  user_role: "USER" | "ADMIN"
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

    // ✅ auth.ts가 user_role을 쓰고 있으므로 user_role로 통일
    const rows = await sql<UserRow>`
      SELECT id, username, password_hash, display_name, user_role
      FROM public.users
      WHERE username = ${username}
      LIMIT 1
    `
    const user = rows[0]
    if (!user) {
      return NextResponse.json({ ok: false, message: "User not found" }, { status: 401 })
    }

    const ok = await verifyPassword(password, user.password_hash)
    if (!ok) {
      return NextResponse.json({ ok: false, message: "Invalid password" }, { status: 401 })
    }

    // ✅ 레거시 해시(sha256)였으면 bcrypt로 업그레이드
    await upgradePasswordHashIfNeeded(user.id, password, user.password_hash)

    // ✅ 세션 생성 + 쿠키 저장 (이게 메인 튕김을 막는 핵심)
    const token = await createSession(user.id)
    await setSessionCookie(token)

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        user_role: user.user_role,
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
