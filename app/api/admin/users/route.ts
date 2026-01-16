import { NextResponse, type NextRequest } from "next/server"
import { getCurrentUser, hashPassword } from "@/lib/auth"
import { sql } from "@/lib/db"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentUser()
    if (!admin || admin.user_role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { username, displayName, password } = await request.json()

    if (!username || !displayName || !password) {
      return NextResponse.json({ error: "모든 필드를 입력해주세요." }, { status: 400 })
    }

    const u = String(username).trim()
    const d = String(displayName).trim()
    const p = String(password)

    if (!u || !d || !p) {
      return NextResponse.json({ error: "모든 필드를 입력해주세요." }, { status: 400 })
    }

    if (p.length < 4) {
      return NextResponse.json({ error: "비밀번호는 최소 4자 이상이어야 합니다." }, { status: 400 })
    }

    const existing = await sql<{ id: number }>`
      SELECT id FROM public.users WHERE username = ${u} LIMIT 1
    `
    if (existing.length > 0) {
      return NextResponse.json({ error: "이미 사용 중인 사용자명입니다." }, { status: 400 })
    }

    const passwordHash = await hashPassword(p)

    const rows = await sql<{ id: number; username: string; display_name: string; user_role: "USER" | "ADMIN" }>`
      INSERT INTO public.users (username, password_hash, display_name, user_role)
      VALUES (${u}, ${passwordHash}, ${d}, 'USER')
      RETURNING id, username, display_name, user_role
    `

    return NextResponse.json({
      user: {
        id: rows[0].id,
        username: rows[0].username,
        displayName: rows[0].display_name,
        userRole: rows[0].user_role,
      },
    })
  } catch (error) {
    console.error("Admin create user error:", error)
    return NextResponse.json({ error: "유저 등록 중 오류가 발생했습니다." }, { status: 500 })
  }
}
