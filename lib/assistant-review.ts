import { sql } from "@/lib/db";

export type ReviewStatus = "pending" | "approved" | "rejected";

export function normalizeQuestion(q: string) {
  return String(q ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function ensureAssistantReviewTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS public.assistant_answer_review_items (
      id BIGSERIAL PRIMARY KEY,
      question TEXT NOT NULL,
      normalized_question TEXT NOT NULL,
      proposed_answer TEXT NOT NULL,
      source_titles TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      reviewer_user_id BIGINT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_assistant_review_items_normalized
    ON public.assistant_answer_review_items (normalized_question, status)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS public.assistant_verified_answers (
      id BIGSERIAL PRIMARY KEY,
      question TEXT NOT NULL,
      normalized_question TEXT NOT NULL UNIQUE,
      answer TEXT NOT NULL,
      source_titles TEXT NOT NULL DEFAULT '',
      reviewer_user_id BIGINT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function getVerifiedAnswer(question: string) {
  await ensureAssistantReviewTables();
  const nq = normalizeQuestion(question);
  const rows = await sql<{ answer: string; source_titles: string }>`
    SELECT answer, source_titles
    FROM public.assistant_verified_answers
    WHERE normalized_question = ${nq}
      AND is_active = TRUE
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function upsertPendingReview(args: {
  question: string;
  proposedAnswer: string;
  sourceTitles?: string;
}) {
  await ensureAssistantReviewTables();
  const nq = normalizeQuestion(args.question);
  const sourceTitles = String(args.sourceTitles ?? "").trim();
  const found = await sql<{ id: number }>`
    SELECT id
    FROM public.assistant_answer_review_items
    WHERE normalized_question = ${nq}
      AND status = 'pending'
    ORDER BY id DESC
    LIMIT 1
  `;
  if (found[0]?.id) {
    await sql`
      UPDATE public.assistant_answer_review_items
      SET question = ${args.question},
          proposed_answer = ${args.proposedAnswer},
          source_titles = ${sourceTitles},
          updated_at = NOW()
      WHERE id = ${found[0].id}
    `;
    return found[0].id;
  }

  const rows = await sql<{ id: number }>`
    INSERT INTO public.assistant_answer_review_items
      (question, normalized_question, proposed_answer, source_titles, status)
    VALUES
      (${args.question}, ${nq}, ${args.proposedAnswer}, ${sourceTitles}, 'pending')
    RETURNING id
  `;
  return rows[0]?.id ?? 0;
}
