import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const idNum = Number(id);
    if (!Number.isFinite(idNum)) {
      return NextResponse.json({ message: "Bad Request" }, { status: 400 });
    }

    const rows = await sql<{
      filename: string;
      mime: string;
      size: number | null;
      data: any; // bytea
    }>`
      select filename, mime, size, data
      from public.uploads
      where id = ${idNum}::bigint
      limit 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    const f = rows[0];
    const mime = f.mime || "application/octet-stream";
    const isImage = String(mime).startsWith("image/");

    // bytea -> Buffer
    const buf = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data);

    // ✅ BodyInit 확정: ArrayBuffer로 전달 (Blob/Uint8Array 타입지옥 회피)
    const body: ArrayBuffer = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    );

    const url = new URL(request.url);
    const download = url.searchParams.get("download") === "1";

    return new NextResponse(body, {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(f.size ?? buf.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": download
          ? `attachment; filename="${encodeURIComponent(f.filename || "file")}"`
          : `${isImage ? "inline" : "attachment"}; filename="${encodeURIComponent(
              f.filename || "file",
            )}"`,
      },
    });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
