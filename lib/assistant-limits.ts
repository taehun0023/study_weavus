import { sql } from "@/lib/db";

export type AssistantLimitSettings = {
  learning_enabled: boolean;
  monthly_budget_usd: number | null;
  daily_budget_usd: number | null;
  daily_token_limit: number | null;
  user_daily_token_limit: number | null;
  user_monthly_token_limit: number | null;
  learning_daily_limit: number | null;
  ocr_daily_page_limit: number | null;
};

function getEnvMonthlyBudgetUSD() {
  const jpyRaw = Number(process.env.ASSISTANT_MONTHLY_BUDGET_JPY ?? "");
  const usdJpyRateRaw = Number(process.env.ASSISTANT_USDJPY ?? "150");
  if (!Number.isFinite(jpyRaw) || jpyRaw <= 0) return null;
  if (!Number.isFinite(usdJpyRateRaw) || usdJpyRateRaw <= 0) return null;
  return Number((jpyRaw / usdJpyRateRaw).toFixed(4));
}

function getEnvDailyBudgetUSD() {
  const usdJpyRateRaw = Number(process.env.ASSISTANT_USDJPY ?? "150");
  if (!Number.isFinite(usdJpyRateRaw) || usdJpyRateRaw <= 0) return null;

  const dailyJpyRaw = Number(process.env.ASSISTANT_DAILY_BUDGET_JPY ?? "");
  if (Number.isFinite(dailyJpyRaw) && dailyJpyRaw > 0) {
    return Number((dailyJpyRaw / usdJpyRateRaw).toFixed(4));
  }

  const monthlyJpyRaw = Number(process.env.ASSISTANT_MONTHLY_BUDGET_JPY ?? "");
  if (Number.isFinite(monthlyJpyRaw) && monthlyJpyRaw > 0) {
    return Number(((monthlyJpyRaw / 30) / usdJpyRateRaw).toFixed(4));
  }

  return null;
}

export async function ensureAssistantLimitTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS public.assistant_runtime_settings (
      id SMALLINT PRIMARY KEY DEFAULT 1,
      learning_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      monthly_budget_usd NUMERIC(12, 4) NULL,
      daily_budget_usd NUMERIC(12, 4) NULL,
      daily_token_limit INTEGER NULL,
      user_daily_token_limit INTEGER NULL,
      user_monthly_token_limit INTEGER NULL,
      learning_daily_limit INTEGER NULL,
      ocr_daily_page_limit INTEGER NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE public.assistant_runtime_settings
    ADD COLUMN IF NOT EXISTS daily_budget_usd NUMERIC(12, 4) NULL
  `;
  await sql`
    ALTER TABLE public.assistant_runtime_settings
    ADD COLUMN IF NOT EXISTS learning_enabled BOOLEAN NOT NULL DEFAULT TRUE
  `;
  await sql`
    ALTER TABLE public.assistant_runtime_settings
    ADD COLUMN IF NOT EXISTS learning_daily_limit INTEGER NULL
  `;
  await sql`
    ALTER TABLE public.assistant_runtime_settings
    ADD COLUMN IF NOT EXISTS ocr_daily_page_limit INTEGER NULL
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS public.assistant_usage_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost_usd NUMERIC(12, 8) NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'ask',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS public.assistant_learning_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      source_type TEXT NOT NULL,
      ocr_pages INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const rows = await sql<{ id: number }>`
    SELECT id
    FROM public.assistant_runtime_settings
    WHERE id = 1
    LIMIT 1
  `;
  if (!rows[0]) {
    await sql`
      INSERT INTO public.assistant_runtime_settings (id)
      VALUES (1)
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

export function estimateTokens(text: string) {
  const len = String(text ?? "").length;
  return Math.max(1, Math.ceil(len / 4));
}

export function estimateCostUSD(inputTokens: number, outputTokens: number) {
  const inCost = (Math.max(0, inputTokens) / 1_000_000) * 0.25;
  const outCost = (Math.max(0, outputTokens) / 1_000_000) * 2.0;
  return Number((inCost + outCost).toFixed(8));
}

export async function getAssistantLimitSettings(): Promise<AssistantLimitSettings> {
  await ensureAssistantLimitTables();
  const rows = await sql<{
    learning_enabled: boolean | null;
    monthly_budget_usd: string | number | null;
    daily_budget_usd: string | number | null;
    daily_token_limit: number | null;
    user_daily_token_limit: number | null;
    user_monthly_token_limit: number | null;
    learning_daily_limit: number | null;
    ocr_daily_page_limit: number | null;
  }>`
    SELECT learning_enabled, monthly_budget_usd, daily_budget_usd, daily_token_limit, user_daily_token_limit, user_monthly_token_limit, learning_daily_limit, ocr_daily_page_limit
    FROM public.assistant_runtime_settings
    WHERE id = 1
    LIMIT 1
  `;
  const r = rows[0];
  const envBudgetUSD = getEnvMonthlyBudgetUSD();
  const envDailyBudgetUSD = getEnvDailyBudgetUSD();
  const dbBudgetUSD =
    r?.monthly_budget_usd == null ? null : Number(r.monthly_budget_usd);
  const dbDailyBudgetUSD =
    r?.daily_budget_usd == null ? null : Number(r.daily_budget_usd);
  const effectiveBudgetUSD =
    dbBudgetUSD == null
      ? envBudgetUSD
      : envBudgetUSD == null
        ? dbBudgetUSD
        : Math.min(dbBudgetUSD, envBudgetUSD);
  const effectiveDailyBudgetUSD =
    dbDailyBudgetUSD == null
      ? envDailyBudgetUSD
      : envDailyBudgetUSD == null
        ? dbDailyBudgetUSD
        : Math.min(dbDailyBudgetUSD, envDailyBudgetUSD);
  return {
    learning_enabled: r?.learning_enabled !== false,
    monthly_budget_usd: effectiveBudgetUSD,
    daily_budget_usd: effectiveDailyBudgetUSD,
    daily_token_limit: r?.daily_token_limit ?? null,
    user_daily_token_limit: r?.user_daily_token_limit ?? null,
    user_monthly_token_limit: r?.user_monthly_token_limit ?? null,
    learning_daily_limit: r?.learning_daily_limit ?? null,
    ocr_daily_page_limit: r?.ocr_daily_page_limit ?? null,
  };
}

export async function getAssistantLearningSnapshot(userId: number) {
  await ensureAssistantLimitTables();
  const rows = await sql<{
    today_total_learning: string | number | null;
    today_user_learning: string | number | null;
    today_total_ocr_pages: string | number | null;
  }>`
    SELECT
      COALESCE(COUNT(*), 0) AS today_total_learning,
      COALESCE(SUM(CASE WHEN user_id = ${userId} THEN 1 ELSE 0 END), 0) AS today_user_learning,
      COALESCE(SUM(ocr_pages), 0) AS today_total_ocr_pages
    FROM public.assistant_learning_logs
    WHERE created_at::date = NOW()::date
  `;
  return {
    today_total_learning: Number(rows[0]?.today_total_learning ?? 0),
    today_user_learning: Number(rows[0]?.today_user_learning ?? 0),
    today_total_ocr_pages: Number(rows[0]?.today_total_ocr_pages ?? 0),
  };
}

export async function getAssistantUsageSnapshot(userId: number) {
  await ensureAssistantLimitTables();

  const today = await sql<{
    total_tokens: string | number | null;
    user_tokens: string | number | null;
    total_cost: string | number | null;
  }>`
    SELECT
      COALESCE(SUM(input_tokens + output_tokens), 0) AS total_tokens,
      COALESCE(SUM(CASE WHEN user_id = ${userId} THEN input_tokens + output_tokens ELSE 0 END), 0) AS user_tokens,
      COALESCE(SUM(estimated_cost_usd), 0) AS total_cost
    FROM public.assistant_usage_logs
    WHERE created_at::date = NOW()::date
  `;

  const month = await sql<{
    user_tokens: string | number | null;
    total_cost: string | number | null;
  }>`
    SELECT
      COALESCE(SUM(CASE WHEN user_id = ${userId} THEN input_tokens + output_tokens ELSE 0 END), 0) AS user_tokens,
      COALESCE(SUM(estimated_cost_usd), 0) AS total_cost
    FROM public.assistant_usage_logs
    WHERE date_trunc('month', created_at) = date_trunc('month', NOW())
  `;

  return {
    today_total_tokens: Number(today[0]?.total_tokens ?? 0),
    today_user_tokens: Number(today[0]?.user_tokens ?? 0),
    today_total_cost_usd: Number(today[0]?.total_cost ?? 0),
    month_user_tokens: Number(month[0]?.user_tokens ?? 0),
    month_total_cost_usd: Number(month[0]?.total_cost ?? 0),
  };
}

export async function checkAssistantLimits(
  userId: number,
  projectedInputTokens: number,
  projectedOutputTokens = 0,
) {
  const settings = await getAssistantLimitSettings();
  const usage = await getAssistantUsageSnapshot(userId);
  const projected = projectedInputTokens + projectedOutputTokens;

  if (
    settings.daily_token_limit != null &&
    usage.today_total_tokens + projected > settings.daily_token_limit
  ) {
    return { ok: false, message: "오늘 AI 토큰 한도를 초과했습니다." };
  }

  if (
    settings.user_daily_token_limit != null &&
    usage.today_user_tokens + projected > settings.user_daily_token_limit
  ) {
    return { ok: false, message: "오늘 사용자별 AI 한도를 초과했습니다." };
  }

  if (
    settings.user_monthly_token_limit != null &&
    usage.month_user_tokens + projected > settings.user_monthly_token_limit
  ) {
    return { ok: false, message: "이번 달 사용자별 AI 한도를 초과했습니다." };
  }

  const projectedCost = estimateCostUSD(projectedInputTokens, projectedOutputTokens);
  if (settings.daily_budget_usd != null) {
    if (usage.today_total_cost_usd + projectedCost > settings.daily_budget_usd) {
      return { ok: false, message: "오늘 AI 예산을 초과했습니다." };
    }
  }

  if (settings.monthly_budget_usd != null) {
    if (usage.month_total_cost_usd + projectedCost > settings.monthly_budget_usd) {
      return { ok: false, message: "이번 달 AI 예산을 초과했습니다." };
    }
  }

  return { ok: true as const };
}

export async function checkAssistantLearningLimits(args: {
  userId: number;
  projectedOcrPages?: number;
}) {
  const settings = await getAssistantLimitSettings();
  const usage = await getAssistantLearningSnapshot(args.userId);
  const projectedOcrPages = Math.max(0, Math.trunc(args.projectedOcrPages ?? 0));

  if (
    settings.learning_daily_limit != null &&
    usage.today_total_learning + 1 > settings.learning_daily_limit
  ) {
    return { ok: false, message: "오늘 문서 학습 횟수 한도를 초과했습니다." };
  }

  if (
    settings.ocr_daily_page_limit != null &&
    usage.today_total_ocr_pages + projectedOcrPages > settings.ocr_daily_page_limit
  ) {
    return { ok: false, message: "오늘 OCR 페이지 한도를 초과했습니다." };
  }

  return { ok: true as const };
}

export async function recordAssistantUsage(args: {
  userId: number;
  inputTokens: number;
  outputTokens: number;
  source?: string;
}) {
  await ensureAssistantLimitTables();
  const cost = estimateCostUSD(args.inputTokens, args.outputTokens);
  await sql`
    INSERT INTO public.assistant_usage_logs
      (user_id, input_tokens, output_tokens, estimated_cost_usd, source)
    VALUES
      (${args.userId}, ${args.inputTokens}, ${args.outputTokens}, ${cost}, ${args.source ?? "ask"})
  `;
}

export async function recordAssistantLearningUsage(args: {
  userId: number;
  sourceType: string;
  ocrPages?: number;
}) {
  await ensureAssistantLimitTables();
  const pages = Math.max(0, Math.trunc(args.ocrPages ?? 0));
  await sql`
    INSERT INTO public.assistant_learning_logs
      (user_id, source_type, ocr_pages)
    VALUES
      (${args.userId}, ${args.sourceType}, ${pages})
  `;
}
