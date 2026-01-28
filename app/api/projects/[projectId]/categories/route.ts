import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { name: string; orderIndex?: number };

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { projectId } = await context.params;
    const pid = Number(projectId);
    if (!Number.isFinite(pid) || pid <= 0) {
      return NextResponse.json(
        { message: "Invalid projectId" },
        { status: 400 },
      );
    }

    const items = await sql<{ id: number; name: string; order_index: number }>`
      SELECT id, name, order_index
      FROM public.project_categories
      WHERE project_id = ${pid}
      ORDER BY name ASC, id ASC
    `;

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
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

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const name = String(body.name ?? "").trim();
    const orderIndex = Number(body.orderIndex ?? 0);

    if (!name)
      return NextResponse.json({ message: "name required" }, { status: 400 });

    const rows = await sql<{ id: number }>`
      INSERT INTO public.project_categories (project_id, name, order_index)
      VALUES (${pid}, ${name}, ${Number.isFinite(orderIndex) ? orderIndex : 0})
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
