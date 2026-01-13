export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

export async function DELETE(
  _: Request,
  { params }: { params: { postId: string } }
) {
  const user = await getCurrentUser()
  if (!user || user.user_role !== "ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  const id = Number(params.postId)
  if (!id) {
    return NextResponse.json({ message: "Invalid postId" }, { status: 400 })
  }

  await sql`DELETE FROM public.posts WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
