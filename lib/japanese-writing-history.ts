import { createHash } from "crypto";
import { pool, sql } from "@/lib/db";
import type { JapaneseLevel } from "@/lib/japanese-writing-ai";

export const JAPANESE_WRITING_DAILY_TARGET = 30;

export type WritingCountReason =
  | "COUNTED"
  | "INCORRECT"
  | "LEVEL_MISMATCH"
  | "ALREADY_COUNTED";

export type WritingCountResult = {
  counted: boolean;
  reason: WritingCountReason;
  todayCount: number;
};

export type JapaneseWritingOkItem = {
  level: JapaneseLevel;
  promptId: string;
  promptKo: string;
  correctedText: string;
  firstOkAt: string;
};

function makeCountedKey(args: {
  userId: number;
  level: JapaneseLevel;
  promptId: string;
  promptKo: string;
  userText: string;
  countDateKey: string;
}) {
  const promptIdentity = args.promptId.trim() || args.promptKo.trim();
  const plain = [
    String(args.userId),
    args.countDateKey,
    args.level,
    promptIdentity,
    args.userText,
  ].join("|");
  return createHash("sha256").update(plain).digest("hex");
}

export async function ensureJapaneseWritingHistoryTable() {
  await sql`
    ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS japanese_level TEXT
  `;

  await sql`
    UPDATE public.users
    SET japanese_level = 'N3'
    WHERE japanese_level IS NULL OR japanese_level = ''
  `;

  await sql`
    ALTER TABLE public.users
    ALTER COLUMN japanese_level SET DEFAULT 'N3'
  `;

  await sql`
    ALTER TABLE public.users
    ALTER COLUMN japanese_level SET NOT NULL
  `;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_japanese_level_check'
      ) THEN
        ALTER TABLE public.users
        ADD CONSTRAINT users_japanese_level_check
        CHECK (japanese_level IN ('N1', 'N2', 'N3', 'N4', 'N5'));
      END IF;
    END
    $$;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS public.japanese_writing_history (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      level TEXT NOT NULL CHECK (level IN ('N1', 'N2', 'N3', 'N4', 'N5')),
      prompt_id TEXT NOT NULL DEFAULT '',
      prompt_ko TEXT NOT NULL DEFAULT '',
      user_text TEXT NOT NULL,
      corrected_text TEXT NOT NULL,
      result TEXT NOT NULL CHECK (result IN ('ok', 'fix')),
      comment TEXT NOT NULL,
      is_correct BOOLEAN NOT NULL DEFAULT FALSE,
      counted BOOLEAN NOT NULL DEFAULT FALSE,
      count_reason TEXT NOT NULL DEFAULT 'INCORRECT',
      counted_key TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE public.japanese_writing_history
    ADD COLUMN IF NOT EXISTS prompt_id TEXT NOT NULL DEFAULT ''
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
    ALTER TABLE public.japanese_writing_history
    ADD COLUMN IF NOT EXISTS is_correct BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await sql`
    ALTER TABLE public.japanese_writing_history
    ADD COLUMN IF NOT EXISTS counted BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await sql`
    ALTER TABLE public.japanese_writing_history
    ADD COLUMN IF NOT EXISTS count_reason TEXT NOT NULL DEFAULT 'INCORRECT'
  `;
  await sql`
    ALTER TABLE public.japanese_writing_history
    ADD COLUMN IF NOT EXISTS counted_key TEXT NULL
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS public.japanese_writing_daily_counts (
      user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      count_date DATE NOT NULL,
      count_value INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, count_date)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_japanese_writing_history_user_created_at
    ON public.japanese_writing_history (user_id, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_japanese_writing_history_user_date_counted
    ON public.japanese_writing_history (user_id, created_at DESC, counted)
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_japanese_writing_history_counted_key
    ON public.japanese_writing_history (counted_key)
    WHERE counted_key IS NOT NULL
  `;
}

export async function getUserJapaneseLevel(userId: number): Promise<JapaneseLevel> {
  await ensureJapaneseWritingHistoryTable();
  const rows = await sql<{ japanese_level: JapaneseLevel }>`
    SELECT japanese_level
    FROM public.users
    WHERE id = ${userId}
    LIMIT 1
  `;
  const level = rows[0]?.japanese_level;
  if (level === "N1" || level === "N2" || level === "N3" || level === "N4" || level === "N5") {
    return level;
  }
  return "N3";
}

export async function getTodayJapaneseWritingCount(userId: number) {
  await ensureJapaneseWritingHistoryTable();
  const rows = await sql<{ count_value: number }>`
    SELECT count_value
    FROM public.japanese_writing_daily_counts
    WHERE user_id = ${userId}
      AND count_date = (NOW() AT TIME ZONE 'Asia/Tokyo')::date
    LIMIT 1
  `;
  return Number(rows[0]?.count_value ?? 0);
}

export async function getSolvedPromptIdsByLevel(args: {
  userId: number;
  level: JapaneseLevel;
}) {
  await ensureJapaneseWritingHistoryTable();
  const rows = await sql<{ prompt_id: string }>`
    SELECT DISTINCT prompt_id
    FROM public.japanese_writing_history
    WHERE user_id = ${args.userId}
      AND level = ${args.level}
      AND is_correct IS TRUE
      AND result = 'ok'
      AND prompt_id <> ''
  `;
  return rows.map((r) => String(r.prompt_id ?? "").trim()).filter(Boolean);
}

export async function getUserJapaneseWritingOkList(userId: number) {
  await ensureJapaneseWritingHistoryTable();
  const rows = await sql<{
    level: JapaneseLevel;
    prompt_id: string;
    prompt_ko: string;
    corrected_text: string;
    first_ok_at: string;
  }>`
    SELECT
      level,
      prompt_id,
      prompt_ko,
      corrected_text,
      to_char(min(created_at), 'YYYY-MM-DD HH24:MI') AS first_ok_at
    FROM public.japanese_writing_history
    WHERE user_id = ${userId}
      AND is_correct IS TRUE
      AND result = 'ok'
    GROUP BY level, prompt_id, prompt_ko, corrected_text
    ORDER BY min(created_at) DESC
    LIMIT 500
  `;

  return rows.map((r) => ({
    level: r.level,
    promptId: String(r.prompt_id ?? ""),
    promptKo: String(r.prompt_ko ?? ""),
    correctedText: String(r.corrected_text ?? ""),
    firstOkAt: String(r.first_ok_at ?? ""),
  })) satisfies JapaneseWritingOkItem[];
}

export async function recordJapaneseWritingAttempt(args: {
  userId: number;
  userLevel: JapaneseLevel;
  problemLevel: JapaneseLevel;
  promptId: string;
  promptKo: string;
  userText: string;
  correctedText: string;
  result: "ok" | "fix";
  comment: string;
}) {
  await ensureJapaneseWritingHistoryTable();

  const isCorrect = args.result === "ok";
  const levelMatched = args.userLevel === args.problemLevel;

  let reason: WritingCountReason = "INCORRECT";
  if (isCorrect && !levelMatched) {
    reason = "LEVEL_MISMATCH";
  } else if (isCorrect && levelMatched) {
    reason = "COUNTED";
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let counted = false;
    const countDateKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const countedKey =
      reason === "COUNTED"
        ? makeCountedKey({
            userId: args.userId,
            countDateKey,
            level: args.problemLevel,
            promptId: args.promptId,
            promptKo: args.promptKo,
            userText: args.userText,
          })
        : null;

    if (reason === "COUNTED" && countedKey) {
      try {
        await client.query(
          `
          INSERT INTO public.japanese_writing_history (
            user_id,
            level,
            prompt_id,
            prompt_ko,
            user_text,
            corrected_text,
            result,
            comment,
            is_correct,
            counted,
            count_reason,
            counted_key
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, true, 'COUNTED', $10
          )
          `,
          [
            args.userId,
            args.problemLevel,
            args.promptId,
            args.promptKo,
            args.userText,
            args.correctedText,
            args.result,
            args.comment,
            isCorrect,
            countedKey,
          ],
        );

        await client.query(
          `
          INSERT INTO public.japanese_writing_daily_counts (
            user_id,
            count_date,
            count_value,
            updated_at
          )
          VALUES ($1, (NOW() AT TIME ZONE 'Asia/Tokyo')::date, 1, NOW())
          ON CONFLICT (user_id, count_date)
          DO UPDATE
          SET count_value = public.japanese_writing_daily_counts.count_value + 1,
              updated_at = NOW()
          `,
          [args.userId],
        );

        counted = true;
      } catch (error: any) {
        if (String(error?.code) === "23505") {
          reason = "ALREADY_COUNTED";
          counted = false;

          await client.query(
            `
            INSERT INTO public.japanese_writing_history (
              user_id,
              level,
              prompt_id,
              prompt_ko,
              user_text,
              corrected_text,
              result,
              comment,
              is_correct,
              counted,
              count_reason,
              counted_key
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, false, 'ALREADY_COUNTED', NULL
            )
            `,
            [
              args.userId,
              args.problemLevel,
              args.promptId,
              args.promptKo,
              args.userText,
              args.correctedText,
              args.result,
              args.comment,
              isCorrect,
            ],
          );
        } else {
          throw error;
        }
      }
    } else {
      await client.query(
        `
        INSERT INTO public.japanese_writing_history (
          user_id,
          level,
          prompt_id,
          prompt_ko,
          user_text,
          corrected_text,
          result,
          comment,
          is_correct,
          counted,
          count_reason,
          counted_key
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10, NULL
        )
        `,
        [
          args.userId,
          args.problemLevel,
          args.promptId,
          args.promptKo,
          args.userText,
          args.correctedText,
          args.result,
          args.comment,
          isCorrect,
          reason,
        ],
      );
    }

    const countRows = await client.query<{ count_value: number }>(
      `
      SELECT count_value
      FROM public.japanese_writing_daily_counts
      WHERE user_id = $1
        AND count_date = (NOW() AT TIME ZONE 'Asia/Tokyo')::date
      LIMIT 1
      `,
      [args.userId],
    );
    const todayCount = Number(countRows.rows[0]?.count_value ?? 0);

    await client.query("COMMIT");
    return {
      counted,
      reason,
      todayCount,
    } satisfies WritingCountResult;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
