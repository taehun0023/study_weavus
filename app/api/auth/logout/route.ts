import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { deleteSession, clearSessionCookie } from "@/lib/auth"

export async function POST() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session_token")?.value
    if (token) await deleteSession(token)

    await clearSessionCookie()
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
