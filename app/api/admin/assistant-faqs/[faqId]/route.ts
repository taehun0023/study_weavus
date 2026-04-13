import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  { params }: { params: Promise<{ faqId: string }> },
) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { faqId } = await params;
  const id = toInt(faqId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ message: "Invalid faqId" }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const question = String(body?.question ?? "").trim();
    const answer = String(body?.answer ?? "").trim();
    const hasIsActive = typeof body?.isActive === "boolean";
    const isActive = hasIsActive ? body.isActive === true : null;

    const existing = await sql<{ id: number; question: string; answer: string; is_active: boolean }>`
      SELECT id, question, answer, is_active
      FROM public.assistant_faqs
      WHERE id = ${id}
      LIMIT 1
    `;
    if (!existing[0]) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    const nextQuestion = question || existing[0].question;
    const nextAnswer = answer || existing[0].answer;
    const nextIsActive = hasIsActive ? Boolean(isActive) : existing[0].is_active;

    const rows = await sql<{
      id: number;
      question: string;
      answer: string;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>`
      UPDATE public.assistant_faqs
      SET question = ${nextQuestion},
          answer = ${nextAnswer},
          is_active = ${nextIsActive},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, question, answer, is_active, created_at, updated_at
    `;

    return NextResponse.json({ ok: true, row: rows[0] });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Failed to update faq" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ faqId: string }> },
) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { faqId } = await params;
  const id = toInt(faqId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ message: "Invalid faqId" }, { status: 400 });
  }

  try {
    const rows = await sql<{ id: number }>`
      DELETE FROM public.assistant_faqs
      WHERE id = ${id}
      RETURNING id
    `;
    if (!rows[0]) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Failed to delete faq" },
      { status: 500 },
    );
  }
}
