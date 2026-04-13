import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getAssistantLimitSettings } from "@/lib/assistant-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureFaqTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS public.assistant_faqs (
      id BIGSERIAL PRIMARY KEY,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.user_role !== "ADMIN") return null;
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureFaqTable();
    const rows = await sql<{
      id: number;
      question: string;
      answer: string;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>`
      SELECT id, question, answer, is_active, created_at, updated_at
      FROM public.assistant_faqs
      ORDER BY id DESC
    `;
    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Failed to load faqs" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getAssistantLimitSettings();
    if (!settings.learning_enabled) {
      return NextResponse.json(
        { message: "학습 모드가 비활성화되어 있어 FAQ 등록이 차단되었습니다." },
        { status: 409 },
      );
    }
    await ensureFaqTable();
    const body = await req.json().catch(() => ({}));
    const question = String(body?.question ?? "").trim();
    const answer = String(body?.answer ?? "").trim();
    const isActive = body?.isActive !== false;

    if (!question) {
      return NextResponse.json({ message: "question required" }, { status: 400 });
    }
    if (!answer) {
      return NextResponse.json({ message: "answer required" }, { status: 400 });
    }

    const rows = await sql<{
      id: number;
      question: string;
      answer: string;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>`
      INSERT INTO public.assistant_faqs (question, answer, is_active)
      VALUES (${question}, ${answer}, ${isActive})
      RETURNING id, question, answer, is_active, created_at, updated_at
    `;

    return NextResponse.json({ ok: true, row: rows[0] });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Failed to create faq" },
      { status: 500 },
    );
  }
}
