import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  name: string;
  orderIndex?: number;
  parentId?: number | null;
};

type CategoryRow = {
  id: number;
  name: string;
  order_index: number;
  parent_id: number | null;
};

function toPositiveInt(v: any) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await context.params;
    const pid = toPositiveInt(projectId);
    if (!pid) {
      return NextResponse.json(
        { message: "Invalid projectId" },
        { status: 400 },
      );
    }

    const items = await sql<CategoryRow>`
      SELECT id, name, order_index, parent_id
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
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (user.user_role !== "ADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { projectId } = await context.params;
    const pid = toPositiveInt(projectId);
    if (!pid) {
      return NextResponse.json(
        { message: "Invalid projectId" },
        { status: 400 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const name = String(body.name ?? "").trim();
    const orderIndex = Number(body.orderIndex ?? 0);

    // parentId: null(루트) 또는 양의 정수만 허용
    const parentIdRaw = (body as any).parentId;
    const parentId =
      parentIdRaw === null || parentIdRaw === undefined || parentIdRaw === ""
        ? null
        : toPositiveInt(parentIdRaw);

    if (!name) {
      return NextResponse.json({ message: "name required" }, { status: 400 });
    }

    // ✅ (추천) parentId가 들어왔으면 같은 project의 카테고리인지 검증
    if (parentId) {
      const p = await sql<{ id: number }>`
        SELECT id
        FROM public.project_categories
        WHERE id = ${parentId} AND project_id = ${pid}
        LIMIT 1
      `;
      if (p.length === 0) {
        return NextResponse.json(
          { message: "Invalid parentId" },
          { status: 400 },
        );
      }
    }

    const rows = await sql<{ id: number }>`
      INSERT INTO public.project_categories (project_id, name, order_index, parent_id)
      VALUES (${pid}, ${name}, ${Number.isFinite(orderIndex) ? orderIndex : 0}, ${parentId})
      RETURNING id
    `;

    if (!rows[0]) {
      return NextResponse.json({ message: "Insert failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}
