import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  title: string;
  uploadId: number;
  overwrite?: boolean;
  existingFileId?: number;
  filename?: string;
};

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string; categoryId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { projectId, categoryId } = await context.params;
    const pid = Number(projectId);
    const cid = Number(categoryId);

    if (!Number.isFinite(pid) || pid <= 0) {
      return NextResponse.json(
        { message: "Invalid projectId" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(cid) || cid <= 0) {
      return NextResponse.json(
        { message: "Invalid categoryId" },
        { status: 400 },
      );
    }

    // ✅ categoryId가 해당 projectId 소속인지 검증
    const ok = await sql<{ id: number }>`
      SELECT id
      FROM public.project_categories
      WHERE id = ${cid} AND project_id = ${pid}
      LIMIT 1
    `;
    if (ok.length === 0) {
      return NextResponse.json(
        { message: "Category not in project" },
        { status: 404 },
      );
    }

    const items = await sql<{
      id: number;
      title: string;
      upload_id: number;
      filename: string;
      mime: string;
      size: number;
      created_at: string;
    }>`
      SELECT pf.id, pf.title, pf.upload_id,
             u.filename, u.mime, u.size, pf.created_at
      FROM public.project_files pf
      JOIN public.uploads u ON u.id = pf.upload_id
      WHERE pf.category_id = ${cid}
      ORDER BY pf.id DESC
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

    if (!Number.isFinite(pid) || pid <= 0) {
      return NextResponse.json(
        { message: "Invalid projectId" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(cid) || cid <= 0) {
      return NextResponse.json(
        { message: "Invalid categoryId" },
        { status: 400 },
      );
    }

    // ✅ categoryId가 해당 projectId 소속인지 검증
    const ok = await sql<{ id: number }>`
      SELECT id
      FROM public.project_categories
      WHERE id = ${cid} AND project_id = ${pid}
      LIMIT 1
    `;
    if (ok.length === 0) {
      return NextResponse.json(
        { message: "Category not in project" },
        { status: 404 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const title = String(body.title ?? "").trim();
    const uploadId = Number(body.uploadId ?? NaN);
    const overwrite = Boolean(body.overwrite);
    const existingFileId = Number(body.existingFileId ?? NaN);
    const filename = String(body.filename ?? "");

    if (!title)
      return NextResponse.json({ message: "title required" }, { status: 400 });
    if (!Number.isFinite(uploadId) || uploadId <= 0)
      return NextResponse.json(
        { message: "uploadId required" },
        { status: 400 },
      );

    // ✅ 덮어쓰기: existingFileId로 update
    if (overwrite && Number.isFinite(existingFileId) && existingFileId > 0) {
      const rows = await sql<{ id: number }>`
        UPDATE public.project_files
        SET title = ${title}, upload_id = ${uploadId}
        WHERE id = ${existingFileId} AND category_id = ${cid}
        RETURNING id
      `;
      if (rows.length === 0) {
        return NextResponse.json(
          { message: "Not found to overwrite" },
          { status: 404 },
        );
      }
      return NextResponse.json({ ok: true, id: rows[0].id, overwritten: true });
    }

    // ✅ 덮어쓰기: filename 기준(옵션)
    if (overwrite && filename) {
      const exist = await sql<{ id: number }>`
        SELECT pf.id
        FROM public.project_files pf
        JOIN public.uploads u ON u.id = pf.upload_id
        WHERE pf.category_id = ${cid} AND u.filename = ${filename}
        ORDER BY pf.id DESC
        LIMIT 1
      `;
      if (exist.length > 0) {
        const rows = await sql<{ id: number }>`
          UPDATE public.project_files
          SET title = ${title}, upload_id = ${uploadId}
          WHERE id = ${exist[0].id}
          RETURNING id
        `;
        return NextResponse.json({
          ok: true,
          id: rows[0].id,
          overwritten: true,
        });
      }
    }

    // ✅ 일반 insert
    const rows = await sql<{ id: number }>`
      INSERT INTO public.project_files (category_id, title, upload_id)
      VALUES (${cid}, ${title}, ${uploadId})
      RETURNING id
    `;

    return NextResponse.json({ ok: true, id: rows[0].id, overwritten: false });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}
