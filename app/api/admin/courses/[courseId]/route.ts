import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { hasCourseVisibilityColumn } from "@/lib/courses";

export const runtime = "nodejs";

function toInt(v: unknown) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeName(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeSlug(v: unknown) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me || me.user_role !== "ADMIN") return null;
  return me;
}

async function ensureVisibilityColumn() {
  const hasVisibility = await hasCourseVisibilityColumn();
  if (hasVisibility) return;
  await sql`
    ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true
  `;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const me = await requireAdmin();
  if (!me) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = await params;
  const id = toInt(courseId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ message: "Invalid courseId" }, { status: 400 });
  }

  try {
    await ensureVisibilityColumn();

    const body = await req.json().catch(() => ({}));
    const name = normalizeName(body?.name);
    const slug = normalizeSlug(body?.slug || body?.name);
    const isPublic = body?.isPublic !== false;

    if (!name) {
      return NextResponse.json({ message: "name required" }, { status: 400 });
    }
    if (!slug) {
      return NextResponse.json({ message: "slug required" }, { status: 400 });
    }

    const dup = await sql<{ id: number }>`
      SELECT id FROM public.courses
      WHERE lower(slug) = ${slug} AND id <> ${id}
      LIMIT 1
    `;
    if (dup.length > 0) {
      return NextResponse.json({ message: "slug already exists" }, { status: 400 });
    }

    const updated = await sql<{ id: number; name: string; slug: string; is_public: boolean }>`
      UPDATE public.courses
      SET name = ${name}, slug = ${slug}, is_public = ${isPublic}
      WHERE id = ${id}
      RETURNING id, name, slug, is_public
    `;
    if (!updated[0]) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, row: updated[0] });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Failed to update course" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const me = await requireAdmin();
  if (!me) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = await params;
  const id = toInt(courseId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ message: "Invalid courseId" }, { status: 400 });
  }

  try {
    const deleted = await sql<{ id: number }>`
      DELETE FROM public.courses
      WHERE id = ${id}
      RETURNING id
    `;
    if (!deleted[0]) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Failed to delete course" },
      { status: 500 },
    );
  }
}
