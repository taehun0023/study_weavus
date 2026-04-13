import { sql } from "@/lib/db";

export type AssistantChatMode =
  | "faq"
  | "llm"
  | "knowledge"
  | "miss"
  | "verified"
  | "pending_review";

export async function ensureAssistantChatLogsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS public.assistant_chat_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      mode TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE public.assistant_chat_logs
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb
  `;
}

export async function recordAssistantChatLog(args: {
  userId: number;
  question: string;
  answer: string;
  mode: AssistantChatMode;
  metadata?: Record<string, unknown>;
}) {
  await ensureAssistantChatLogsTable();
  await sql`
    INSERT INTO public.assistant_chat_logs (user_id, question, answer, mode, metadata)
    VALUES (
      ${args.userId},
      ${args.question},
      ${args.answer},
      ${args.mode},
      ${JSON.stringify(args.metadata ?? {})}::jsonb
    )
  `;
}
