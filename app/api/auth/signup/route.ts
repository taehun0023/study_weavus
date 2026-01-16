import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { hashPassword, createSession } from "@/lib/auth"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    const { username, displayName, password } = await request.json()

    if (!username || !displayName || !password) {
      return NextResponse.json({ error: "모든 필드를 입력해주세요." }, { status: 400 })
    }

    if (password.length < 4) {
      return NextResponse.json({ error: "비밀번호는 최소 4자 이상이어야 합니다." }, { status: 400 })
    }

    // Check if username already exists
    const existingUsers = await sql`
      SELECT id FROM users WHERE username = ${username}
    `

    if (existingUsers.length > 0) {
      return NextResponse.json({ error: "이미 사용 중인 사용자명입니다." }, { status: 400 })
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password)

    const newUsers = await sql`
      INSERT INTO users (username, password_hash, display_name, user_role)
      VALUES (${username}, ${passwordHash}, ${displayName}, 'USER')
      RETURNING id, username, display_name, user_role
    `

    const newUser = newUsers[0]

    // Create session and log in automatically
    const token = await createSession(newUser.id)

    const cookieStore = await cookies()
    cookieStore.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    })

    return NextResponse.json({
      user: {
        id: newUser.id,
        username: newUser.username,
        displayName: newUser.display_name,
        userRole: newUser.user_role ?? "USER",
      },
    })
  } catch (error) {
    console.error("Signup error:", error)
    return NextResponse.json({ error: "회원가입 중 오류가 발생했습니다." }, { status: 500 })
  }
}
