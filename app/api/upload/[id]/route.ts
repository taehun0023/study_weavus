import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const rows = await sql<{
    filename: string
    mime: string
    data: any // ✅ 타입충돌 방지 (아래에서 Uint8Array로 변환)
  }>`
    SELECT filename, mime, data
    FROM public.uploads
    WHERE id = ${id}::bigint
    LIMIT 1
  `

  if (rows.length === 0) {
    return NextResponse.json({ message: "Not found" }, { status: 404 })
  }

  const f = rows[0]
  const isImage = String(f.mime || "").startsWith("image/")

  // ✅ 핵심: BodyInit로 넣기 위해 Uint8Array로 변환
  // Neon/pg는 BYTEA를 Buffer로 주는 경우가 많음
  const body =
    f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data)

  return new NextResponse(body, {
    headers: {
      "Content-Type": f.mime || "application/octet-stream",
      "Content-Disposition": `${isImage ? "inline" : "attachment"}; filename="${encodeURIComponent(
        f.filename || "file"
      )}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
