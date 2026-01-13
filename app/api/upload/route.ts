import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ message: "file is required" }, { status: 400 })
    }

    const ab = await file.arrayBuffer()
    const buf = Buffer.from(ab)

    const rows = await sql<{ id: string }>`
      INSERT INTO public.uploads (filename, mime, size, data)
      VALUES (${file.name}, ${file.type || "application/octet-stream"}, ${file.size}, ${buf})
      RETURNING id::text
    `
    const id = rows[0]?.id

    return NextResponse.json({
      id,
      url: `/api/upload/${id}`, // ✅ 폴더명이 upload라서
      filename: file.name,
    })
  } catch (e: any) {
    return NextResponse.json({ message: e?.message ?? "Upload failed" }, { status: 500 })
  }
}
