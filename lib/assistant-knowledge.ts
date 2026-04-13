import { sql } from "@/lib/db";

export async function ensureAssistantKnowledgeTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS public.assistant_knowledge_docs (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'manual',
      source_id BIGINT NULL,
      mime TEXT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE public.assistant_knowledge_docs
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb
  `;
}

export async function upsertKnowledgeFromPost(args: {
  postId: number;
  title: string;
  content: string;
  isActive: boolean;
}) {
  await ensureAssistantKnowledgeTable();

  const found = await sql<{ id: number }>`
    SELECT id
    FROM public.assistant_knowledge_docs
    WHERE source_type = 'post' AND source_id = ${args.postId}
    ORDER BY id DESC
    LIMIT 1
  `;

  if (found[0]?.id) {
    await sql`
      UPDATE public.assistant_knowledge_docs
      SET title = ${args.title},
          content = ${args.content},
          is_active = ${args.isActive},
          metadata = COALESCE(metadata, '{}'::jsonb),
          updated_at = NOW()
      WHERE id = ${found[0].id}
    `;
    return;
  }

  await sql`
    INSERT INTO public.assistant_knowledge_docs
      (title, content, source_type, source_id, mime, is_active, metadata)
    VALUES
      (
        ${args.title},
        ${args.content},
        'post',
        ${args.postId},
        'text/html',
        ${args.isActive},
        ${JSON.stringify({ sourceType: "post", sourceId: args.postId })}::jsonb
      )
  `;
}
