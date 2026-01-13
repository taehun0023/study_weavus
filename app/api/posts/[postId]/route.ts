import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

type Ctx = { params: { postId: string } }

function parseId(raw: string) {
  // "1", "001", "1?x=y"(없지만 방어) 같은 케이스 방어
  const id = parseInt(String(raw), 10)
  if (!Number.isFinite(id) || id <= 0) return null
  return id
}

export async function DELETE(_: Request, { params }: Ctx) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (user.user_role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const id = parseId(params.postId)
  if (!id) return NextResponse.json({ message: "Invalid postId" }, { status: 400 })

  await sql`DELETE FROM public.posts WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}

export async function PUT(req: Request, { params }: Ctx) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (user.user_role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const id = parseId(params.postId)
  if (!id) return NextResponse.json({ message: "Invalid postId" }, { status: 400 })

  const body = await req.json()
  const title = String(body.title ?? "").trim()
  const content = String(body.content ?? "").trim()
  const difficulty = body.difficulty ?? null

  if (!title) return NextResponse.json({ message: "title is required" }, { status: 400 })

  const updated = await sql`
    UPDATE public.posts
    SET title = ${title},
        content = ${content},
        difficulty = ${difficulty}
    WHERE id = ${id}
    RETURNING id
  `
  return NextResponse.json({ id: updated?.[0]?.id ?? id })
}
