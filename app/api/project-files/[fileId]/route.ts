import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (user.user_role !== "ADMIN")
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { fileId } = await context.params;
    const fid = Number(fileId);
    if (!Number.isFinite(fid) || fid <= 0) {
      return NextResponse.json({ message: "Invalid fileId" }, { status: 400 });
    }

    const rows = await sql<{ id: number }>`
      delete from public.project_files
      where id = ${fid}
      returning id
    `;

    if (rows.length === 0) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}
