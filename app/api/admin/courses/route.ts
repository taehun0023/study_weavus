import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { hasCourseVisibilityColumn, listCourses } from "@/lib/courses";

export const runtime = "nodejs";

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

async function syncCourseIdSequence() {
  await sql`
    SELECT setval(
      pg_get_serial_sequence('public.courses', 'id'),
      COALESCE((SELECT MAX(id) FROM public.courses), 1),
      true
    )
  `;
}

async function ensureVisibilityColumn() {
  const hasVisibility = await hasCourseVisibilityColumn();
  if (hasVisibility) return;
  await sql`
    ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true
  `;
}

export async function GET() {
  const me = await requireAdmin();
  if (!me) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await listCourses({ includePrivate: true });
    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Failed to load courses" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const me = await requireAdmin();
  if (!me) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
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
      SELECT id FROM public.courses WHERE lower(slug) = ${slug} LIMIT 1
    `;
    if (dup.length > 0) {
      return NextResponse.json({ message: "slug already exists" }, { status: 400 });
    }

    let inserted: { id: number; name: string; slug: string; is_public: boolean }[] = [];
    try {
      inserted = await sql<{ id: number; name: string; slug: string; is_public: boolean }>`
        INSERT INTO public.courses (name, slug, is_public)
        VALUES (${name}, ${slug}, ${isPublic})
        RETURNING id, name, slug, is_public
      `;
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      // id sequence가 꼬여 pkey 충돌이 나면 한 번 보정 후 재시도
      if (msg.includes("courses_pkey") || msg.includes("Key (id)=")) {
        await syncCourseIdSequence();
        inserted = await sql<{ id: number; name: string; slug: string; is_public: boolean }>`
          INSERT INTO public.courses (name, slug, is_public)
          VALUES (${name}, ${slug}, ${isPublic})
          RETURNING id, name, slug, is_public
        `;
      } else {
        throw e;
      }
    }

    return NextResponse.json({ ok: true, row: inserted[0] });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Failed to create course" },
      { status: 500 },
    );
  }
}
