import { NextResponse, type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import {
  createSession,
  setSessionCookie,
  verifyPassword,
  upgradePasswordHashIfNeeded,
} from "@/lib/auth"

export const runtime = "nodejs"

type Body = { username?: string; password?: string }

type UserRow = {
  id: number
  username: string
  password_hash: string
  display_name: string
  user_role: "USER" | "ADMIN" | null
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body
  const username = typeof body.username === "string" ? body.username.trim() : ""
  const password = typeof body.password === "string" ? body.password : ""

  if (!username || !password) {
    return NextResponse.json({ error: "아이디/비밀번호를 입력하세요." }, { status: 400 })
  }

  const users = await sql<UserRow>`
    SELECT id, username, password_hash, display_name, user_role
    FROM public.users
    WHERE username = ${username}
    LIMIT 1
  `

  const user = users[0]
  if (!user) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 })
  }

  const ok = await verifyPassword(password, user.password_hash)
  if (!ok) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 })
  }

  await upgradePasswordHashIfNeeded(user.id, password, user.password_hash)

  const token = await createSession(user.id)
  await setSessionCookie(token)

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      userRole: (user.user_role ?? "USER") as "USER" | "ADMIN",
    },
  })
}
