import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  ensureAssistantReviewTables,
  normalizeQuestion,
} from "@/lib/assistant-review";

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
  { params }: { params: Promise<{ reviewId: string }> },
) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { reviewId } = await params;
  const id = toInt(reviewId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ message: "Invalid reviewId" }, { status: 400 });
  }

  try {
    await ensureAssistantReviewTables();
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "").trim().toLowerCase();
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { message: "action must be approve or reject" },
        { status: 400 },
      );
    }

    const rows = await sql<{
      id: number;
      question: string;
      proposed_answer: string;
      source_titles: string;
      status: string;
    }>`
      SELECT id, question, proposed_answer, source_titles, status
      FROM public.assistant_answer_review_items
      WHERE id = ${id}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    if (row.status !== "pending") {
      return NextResponse.json(
        { message: "이미 처리된 검수 항목입니다." },
        { status: 409 },
      );
    }

    if (action === "approve") {
      const nq = normalizeQuestion(row.question);
      await sql`
        INSERT INTO public.assistant_verified_answers
          (question, normalized_question, answer, source_titles, reviewer_user_id, is_active, updated_at)
        VALUES
          (${row.question}, ${nq}, ${row.proposed_answer}, ${row.source_titles}, ${user.id}, TRUE, NOW())
        ON CONFLICT (normalized_question)
        DO UPDATE SET
          question = EXCLUDED.question,
          answer = EXCLUDED.answer,
          source_titles = EXCLUDED.source_titles,
          reviewer_user_id = EXCLUDED.reviewer_user_id,
          is_active = TRUE,
          updated_at = NOW()
      `;
    }

    await sql`
      UPDATE public.assistant_answer_review_items
      SET status = ${action === "approve" ? "approved" : "rejected"},
          reviewer_user_id = ${user.id},
          updated_at = NOW()
      WHERE id = ${id}
    `;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Failed to update review item" },
      { status: 500 },
    );
  }
}
