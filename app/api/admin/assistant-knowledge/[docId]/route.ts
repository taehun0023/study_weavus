import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

function toInt(v: unknown) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : NaN;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.user_role !== "ADMIN") return null;
  return user;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ docId: string }> },
) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { docId } = await params;
  const id = toInt(docId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ message: "Invalid docId" }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const isActive = body?.isActive === true;
    const rows = await sql<{ id: number }>`
      UPDATE public.assistant_knowledge_docs
      SET is_active = ${isActive},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `;
    if (!rows[0]) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Failed to update doc" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ docId: string }> },
) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { docId } = await params;
  const id = toInt(docId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ message: "Invalid docId" }, { status: 400 });
  }
  try {
    const rows = await sql<{ id: number }>`
      DELETE FROM public.assistant_knowledge_docs
      WHERE id = ${id}
      RETURNING id
    `;
    if (!rows[0]) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Failed to delete doc" },
      { status: 500 },
    );
  }
}
