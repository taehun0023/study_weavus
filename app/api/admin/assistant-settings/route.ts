import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  ensureAssistantLimitTables,
  getAssistantLimitSettings,
  getAssistantLearningSnapshot,
  getAssistantUsageSnapshot,
} from "@/lib/assistant-limits";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.user_role !== "ADMIN") return null;
  return user;
}

function toNumOrNull(v: unknown) {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureAssistantLimitTables();
    const settings = await getAssistantLimitSettings();
    const usage = await getAssistantUsageSnapshot(user.id);
    const learningUsage = await getAssistantLearningSnapshot(user.id);
    return NextResponse.json({ ok: true, settings, usage, learningUsage });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Failed to load settings" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureAssistantLimitTables();
    const body = await req.json().catch(() => ({}));
    const current = await getAssistantLimitSettings();

    const monthlyBudget = toNumOrNull(body?.monthly_budget_usd);
    const dailyBudget = toNumOrNull(body?.daily_budget_usd);
    const dailyLimit = toNumOrNull(body?.daily_token_limit);
    const userDailyLimit = toNumOrNull(body?.user_daily_token_limit);
    const userMonthlyLimit = toNumOrNull(body?.user_monthly_token_limit);
    const learningDailyLimit = toNumOrNull(body?.learning_daily_limit);
    const ocrDailyPageLimit = toNumOrNull(body?.ocr_daily_page_limit);
    const learningEnabled =
      typeof body?.learning_enabled === "boolean"
        ? body.learning_enabled
        : current.learning_enabled;

    await sql`
      UPDATE public.assistant_runtime_settings
      SET learning_enabled = ${learningEnabled},
          monthly_budget_usd = ${monthlyBudget},
          daily_budget_usd = ${dailyBudget},
          daily_token_limit = ${dailyLimit},
          user_daily_token_limit = ${userDailyLimit},
          user_monthly_token_limit = ${userMonthlyLimit},
          learning_daily_limit = ${learningDailyLimit},
          ocr_daily_page_limit = ${ocrDailyPageLimit},
          updated_at = NOW()
      WHERE id = 1
    `;

    const settings = await getAssistantLimitSettings();
    return NextResponse.json({ ok: true, settings });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Failed to save settings" },
      { status: 500 },
    );
  }
}
