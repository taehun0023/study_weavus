import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  courseId: number;
  name: string;
  slug: string;
};

function normalizeSlug(v: unknown) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const courseId = Number(searchParams.get("courseId") ?? NaN);

    if (!Number.isFinite(courseId) || courseId <= 0) {
      return NextResponse.json(
        { message: "Invalid courseId" },
        { status: 400 },
      );
    }

    const items = await sql<{ id: number; name: string; slug: string }>`
      SELECT id, name, slug
      FROM public.projects
      WHERE course_id = ${courseId}
      ORDER BY id DESC
    `;

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (user.user_role !== "ADMIN")
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const courseId = Number(body.courseId ?? NaN);
    const name = String(body.name ?? "").trim();
    const slug = normalizeSlug(body.slug ?? body.name);

    if (!Number.isFinite(courseId) || courseId <= 0)
      return NextResponse.json(
        { message: "Invalid courseId" },
        { status: 400 },
      );
    if (!name)
      return NextResponse.json({ message: "name required" }, { status: 400 });
    if (!slug)
      return NextResponse.json({ message: "slug required" }, { status: 400 });

    const rows = await sql<{ id: number }>`
      INSERT INTO public.projects (course_id, name, slug)
      VALUES (${courseId}, ${name}, ${slug})
      RETURNING id
    `;

    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}
