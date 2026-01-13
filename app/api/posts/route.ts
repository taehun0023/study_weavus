import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { sql } from "@/lib/db"

export const runtime = "nodejs"

type Body = {
  title: string
  courseId: number
  type: "lesson" | "quiz" | "reference"
  difficulty?: "easy" | "medium" | "hard" | "project" | null
  content: string
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (user.user_role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const body = (await req.json().catch(() => ({} as Body))) as Partial<Body>
  const title = String(body.title ?? "").trim()
  const content = String(body.content ?? "")
  const courseId = Number(body.courseId ?? NaN)

  if (!title) return NextResponse.json({ message: "제목이 비었습니다." }, { status: 400 })
  if (!Number.isFinite(courseId) || courseId <= 0) {
    return NextResponse.json({ message: "과목이 없습니다." }, { status: 400 })
  }

  const type = (body.type ?? "lesson") as Body["type"]
  const difficulty = (body.difficulty ?? null) as Body["difficulty"]

  const rows = await sql<{ id: number }>`
    INSERT INTO public.posts (course_id, title, type, difficulty, content)
    VALUES (${courseId}, ${title}, ${type}, ${difficulty}, ${content})
    RETURNING id
  `
  return NextResponse.json({ ok: true, id: rows[0].id })
}
