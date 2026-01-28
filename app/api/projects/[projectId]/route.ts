import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  name?: string;
  slug?: string;
};

async function updateProject(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (user.user_role !== "ADMIN")
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { projectId } = await context.params;
  const pid = Number(projectId);
  if (!Number.isFinite(pid) || pid <= 0) {
    return NextResponse.json({ message: "Invalid projectId" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<Body>;
  const name = body.name !== undefined ? String(body.name).trim() : undefined;
  const slug =
    body.slug !== undefined
      ? String(body.slug).trim().toLowerCase()
      : undefined;

  if (name !== undefined && !name) {
    return NextResponse.json({ message: "name required" }, { status: 400 });
  }
  if (slug !== undefined && !slug) {
    return NextResponse.json({ message: "slug required" }, { status: 400 });
  }

  const rows = await sql<{ id: number }>`
    UPDATE public.projects
    SET
      name = COALESCE(${name ?? null}, name),
      slug = COALESCE(${slug ?? null}, slug)
    WHERE id = ${pid}
    RETURNING id
  `;

  if (rows.length === 0) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

// ✅ PATCH로 수정
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    return await updateProject(req, context);
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}

// ✅ PUT로 수정(프론트가 PUT 보내도 405 안 나게)
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    return await updateProject(req, context);
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}

// ✅ 삭제(필요하면)
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (user.user_role !== "ADMIN")
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { projectId } = await context.params;
    const pid = Number(projectId);
    if (!Number.isFinite(pid) || pid <= 0) {
      return NextResponse.json(
        { message: "Invalid projectId" },
        { status: 400 },
      );
    }

    const rows = await sql<{ id: number }>`
      DELETE FROM public.projects
      WHERE id = ${pid}
      RETURNING id
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
