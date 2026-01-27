import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { message: "file is required" },
        { status: 400 },
      );
    }

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);

    const rows = await sql<{ id: string }>`
      INSERT INTO public.uploads (filename, mime, size, data)
      VALUES (${file.name}, ${file.type || "application/octet-stream"}, ${file.size}, ${buf})
      RETURNING id::text
    `;

    const id = rows[0]?.id;
    if (!id) {
      return NextResponse.json({ message: "Upload failed" }, { status: 500 });
    }

    // ✅ 프론트에서 쓰는 키들로 응답 통일 (호환성 유지)
    return NextResponse.json({
      id: Number(id), // 프론트에서 Number() 하는 케이스가 많아서
      url: `/api/upload/${id}`,
      originalName: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Upload failed" },
      { status: 500 },
    );
  }
}
