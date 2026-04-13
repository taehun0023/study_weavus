import { sql } from "@/lib/db";
import type { JapaneseLevel, WritingReviewResult } from "@/lib/japanese-writing-ai";

export async function ensureJapaneseWritingHistoryTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS public.japanese_writing_history (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      level TEXT NOT NULL CHECK (level IN ('N1', 'N2', 'N3', 'N4', 'N5')),
      prompt_ko TEXT NOT NULL DEFAULT '',
      user_text TEXT NOT NULL,
      corrected_text TEXT NOT NULL,
      result TEXT NOT NULL CHECK (result IN ('ok', 'fix')),
      comment TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE public.japanese_writing_history
    ADD COLUMN IF NOT EXISTS prompt_ko TEXT NOT NULL DEFAULT ''
  `;
  await sql`
    ALTER TABLE public.japanese_writing_history
    ADD COLUMN IF NOT EXISTS user_text TEXT NOT NULL DEFAULT ''
  `;
  await sql`
    ALTER TABLE public.japanese_writing_history
    ADD COLUMN IF NOT EXISTS corrected_text TEXT NOT NULL DEFAULT ''
  `;
  await sql`
    ALTER TABLE public.japanese_writing_history
    ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT 'fix'
  `;
  await sql`
    ALTER TABLE public.japanese_writing_history
    ADD COLUMN IF NOT EXISTS comment TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_japanese_writing_history_user_created_at
    ON public.japanese_writing_history (user_id, created_at DESC)
  `;
}

export async function insertJapaneseWritingHistory(args: {
  userId: number;
  level: JapaneseLevel;
  promptKo: string;
  review: WritingReviewResult;
}) {
  await ensureJapaneseWritingHistoryTable();

  await sql`
    INSERT INTO public.japanese_writing_history (
      user_id,
      level,
      prompt_ko,
      user_text,
      corrected_text,
      result,
      comment
    )
    VALUES (
      ${args.userId},
      ${args.level},
      ${args.promptKo},
      ${args.review.userText},
      ${args.review.correctedText},
      ${args.review.result},
      ${args.review.comment}
    )
  `;
}
