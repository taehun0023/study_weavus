// app/api/posts/[postId]/route.ts
export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

type Ctx = { params: { postId: string } }

function parseId(raw: string) {
  const id = parseInt(String(raw), 10)
  if (!Number.isFinite(id) || id <= 0) return null
  return id
}

export async function DELETE(_: Request, { params }: Ctx) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    if (user.user_role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

    const id = parseId(params.postId)
    if (!id) return NextResponse.json({ message: "Invalid postId" }, { status: 400 })

    await sql`DELETE FROM public.posts WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "DELETE failed" },
      { status: 500 }
    )
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    if (user.user_role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

    const id = parseId(params.postId)
    if (!id) return NextResponse.json({ message: "Invalid postId" }, { status: 400 })

    const body = await req.json().catch(() => ({} as any))
    const title = String(body.title ?? "").trim()
    const content = String(body.content ?? "").trim()
    const difficulty = (body.difficulty ?? null) as "easy" | "medium" | "hard" | "project" | null

    const courseIdRaw = Number(body.courseId ?? NaN)
    const courseId = Number.isFinite(courseIdRaw) && courseIdRaw > 0 ? courseIdRaw : null

    if (!title) return NextResponse.json({ message: "title is required" }, { status: 400 })

    const updated = await sql`
      UPDATE public.posts
      SET title = ${title},
          content = ${content},
          difficulty = ${difficulty},
          course_id = COALESCE(${courseId}, course_id)
      WHERE id = ${id}
      RETURNING id
    `
    return NextResponse.json({ id: updated?.[0]?.id ?? id })
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "PUT failed" },
      { status: 500 }
    )
  }
}
