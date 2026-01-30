import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = {
  name?: string;
  orderIndex?: number;
  parentId?: number | null;
};

function toPositiveInt(v: any) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string; categoryId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (user.user_role !== "ADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { projectId, categoryId } = await context.params;
    const pid = toPositiveInt(projectId);
    const cid = toPositiveInt(categoryId);

    if (!pid) {
      return NextResponse.json(
        { message: "Invalid projectId" },
        { status: 400 },
      );
    }
    if (!cid) {
      return NextResponse.json(
        { message: "Invalid categoryId" },
        { status: 400 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as PatchBody;

    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    const orderIndex =
      body.orderIndex !== undefined ? Number(body.orderIndex) : undefined;

    // ✅ parentId 파싱: null(루트) / 양의 정수 / undefined(미변경)
    const parentIdRaw = (body as any).parentId;
    const parentId =
      parentIdRaw === undefined
        ? undefined
        : parentIdRaw === null || parentIdRaw === ""
          ? null
          : toPositiveInt(parentIdRaw);

    if (name !== undefined && !name) {
      return NextResponse.json({ message: "name required" }, { status: 400 });
    }
    if (orderIndex !== undefined && !Number.isFinite(orderIndex)) {
      return NextResponse.json(
        { message: "orderIndex invalid" },
        { status: 400 },
      );
    }

    // ✅ parentId 검증(입력된 경우만)
    if (parentId !== undefined) {
      // 1) 자기 자신을 부모로 지정 금지
      if (parentId === cid) {
        return NextResponse.json(
          { message: "parentId cannot be itself" },
          { status: 400 },
        );
      }

      // 2) parentId가 null이 아니면 같은 프로젝트에 존재해야 함
      if (parentId !== null) {
        if (!parentId) {
          return NextResponse.json(
            { message: "parentId invalid" },
            { status: 400 },
          );
        }

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

        // 3) (중요) 자식/손자 밑으로 이동 금지 → 사이클 방지
        // parentId가 cid의 하위라면 금지
        const cycle = await sql<{ id: number }>`
          WITH RECURSIVE descendants AS (
            SELECT id, parent_id
            FROM public.project_categories
            WHERE parent_id = ${cid} AND project_id = ${pid}
            UNION ALL
            SELECT c.id, c.parent_id
            FROM public.project_categories c
            INNER JOIN descendants d ON c.parent_id = d.id
            WHERE c.project_id = ${pid}
          )
          SELECT id FROM descendants WHERE id = ${parentId} LIMIT 1
        `;
        if (cycle.length > 0) {
          return NextResponse.json(
            { message: "parentId cannot be a descendant" },
            { status: 400 },
          );
        }
      }
    }

    // ✅ COALESCE에 undefined를 넣으면 의도치 않게 null로 갈 수 있으니 분기 처리
    const rows = await sql<{ id: number }>`
      UPDATE public.project_categories
      SET
        name = COALESCE(${name ?? null}, name),
        order_index = COALESCE(${Number.isFinite(orderIndex as any) ? orderIndex : null}, order_index),
        parent_id = COALESCE(${parentId === undefined ? null : parentId}, parent_id)
      WHERE id = ${cid} AND project_id = ${pid}
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

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string; categoryId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (user.user_role !== "ADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { projectId, categoryId } = await context.params;
    const pid = toPositiveInt(projectId);
    const cid = toPositiveInt(categoryId);

    if (!pid) {
      return NextResponse.json(
        { message: "Invalid projectId" },
        { status: 400 },
      );
    }
    if (!cid) {
      return NextResponse.json(
        { message: "Invalid categoryId" },
        { status: 400 },
      );
    }

    const rows = await sql<{ id: number }>`
      DELETE FROM public.project_categories
      WHERE id = ${cid} AND project_id = ${pid}
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
