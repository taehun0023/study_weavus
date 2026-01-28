import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = { name?: string; orderIndex?: number };

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string; categoryId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (user.user_role !== "ADMIN")
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { projectId, categoryId } = await context.params;
    const pid = Number(projectId);
    const cid = Number(categoryId);

    if (!Number.isFinite(pid) || pid <= 0)
      return NextResponse.json(
        { message: "Invalid projectId" },
        { status: 400 },
      );
    if (!Number.isFinite(cid) || cid <= 0)
      return NextResponse.json(
        { message: "Invalid categoryId" },
        { status: 400 },
      );

    const body = (await req.json().catch(() => ({}))) as PatchBody;
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    const orderIndex =
      body.orderIndex !== undefined ? Number(body.orderIndex) : undefined;

    if (name !== undefined && !name)
      return NextResponse.json({ message: "name required" }, { status: 400 });
    if (orderIndex !== undefined && !Number.isFinite(orderIndex))
      return NextResponse.json(
        { message: "orderIndex invalid" },
        { status: 400 },
      );

    const rows = await sql<{ id: number }>`
      UPDATE public.project_categories
      SET
        name = coalesce(${name ?? null}, name),
        order_index = coalesce(${orderIndex ?? null}, order_index)
      WHERE id = ${cid} AND project_id = ${pid}
      RETURNING id
    `;
    if (rows.length === 0)
      return NextResponse.json({ message: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string; categoryId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (user.user_role !== "ADMIN")
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { projectId, categoryId } = await context.params;
    const pid = Number(projectId);
    const cid = Number(categoryId);

    if (!Number.isFinite(pid) || pid <= 0)
      return NextResponse.json(
        { message: "Invalid projectId" },
        { status: 400 },
      );
    if (!Number.isFinite(cid) || cid <= 0)
      return NextResponse.json(
        { message: "Invalid categoryId" },
        { status: 400 },
      );

    const rows = await sql<{ id: number }>`
      DELETE FROM public.project_categories
      WHERE id = ${cid} AND project_id = ${pid}
      RETURNING id
    `;
    if (rows.length === 0)
      return NextResponse.json({ message: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}
