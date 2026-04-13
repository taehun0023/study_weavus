import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ensureAssistantReviewTables } from "@/lib/assistant-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    await ensureAssistantReviewTables();
    const rows = await sql<{
      id: number;
      question: string;
      proposed_answer: string;
      source_titles: string;
      status: string;
      created_at: string;
      updated_at: string;
    }>`
      SELECT id, question, proposed_answer, source_titles, status, created_at, updated_at
      FROM public.assistant_answer_review_items
      WHERE status = 'pending'
      ORDER BY id DESC
      LIMIT 200
    `;
    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Failed to load review items" },
      { status: 500 },
    );
  }
}
