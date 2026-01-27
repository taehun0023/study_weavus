import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "only image/* allowed" }, { status: 400 });
    }

    // 용량 제한(원하면 바꿔)
    const MAX = 2 * 1024 * 1024;
    if (file.size > MAX) {
      return NextResponse.json({ error: "file too large" }, { status: 413 });
    }

    const buf = Buffer.from(await file.arrayBuffer());

    const rows = await sql<{ id: number }>`
      insert into uploads (filename, mime, size, data)
      values (${file.name}, ${file.type}, ${file.size}, ${buf})
      returning id
    `;

    const id = rows[0]?.id;
    if (!id) throw new Error("insert failed");

    return NextResponse.json({ id, url: `/api/uploads/${id}` });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "upload failed" },
      { status: 500 },
    );
  }
}
