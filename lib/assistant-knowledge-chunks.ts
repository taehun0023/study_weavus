import { pool, sql } from "@/lib/db";
import { chunkText } from "@/lib/assistant-chunking";
import { createEmbedding, EMBEDDING_DIM, toVectorLiteral } from "@/lib/assistant-embeddings";

export type RetrievedChunk = {
  doc_id: number;
  title: string;
  content: string;
  content_norm?: string;
  similarity: number;
  chunk_index: number;
};

export function normalizeForSearch(input: string) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function ensureAssistantKnowledgeChunksTable() {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.assistant_knowledge_chunks (
      id BIGSERIAL PRIMARY KEY,
      doc_id BIGINT NOT NULL REFERENCES public.assistant_knowledge_docs(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      content_norm TEXT NOT NULL DEFAULT '',
      chunk_index INTEGER NOT NULL DEFAULT 0,
      embedding vector(${EMBEDDING_DIM}) NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await sql`
    ALTER TABLE public.assistant_knowledge_chunks
    ADD COLUMN IF NOT EXISTS content_norm TEXT NOT NULL DEFAULT ''
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_chunks_doc_id
    ON public.assistant_knowledge_chunks(doc_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_chunks_content_norm
    ON public.assistant_knowledge_chunks USING gin (to_tsvector('simple', content_norm))
  `;
}

export async function ensureAssistantKnowledgeDocMetadata() {
  await sql`
    ALTER TABLE public.assistant_knowledge_docs
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb
  `;
}

export async function indexKnowledgeDoc(args: {
  docId: number;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}) {
  await ensureAssistantKnowledgeChunksTable();
  const chunks = chunkText(args.content, { chunkSize: 1100, overlap: 180 });

  await sql`DELETE FROM public.assistant_knowledge_chunks WHERE doc_id = ${args.docId}`;
  for (const chunk of chunks) {
    const vector = await createEmbedding(chunk.content);
    if (!vector.length) continue;
    const vectorLiteral = toVectorLiteral(vector);
    const norm = normalizeForSearch(chunk.content);
    await sql`
      INSERT INTO public.assistant_knowledge_chunks
        (doc_id, title, content, content_norm, chunk_index, embedding, metadata)
      VALUES
        (
          ${args.docId},
          ${args.title},
          ${chunk.content},
          ${norm},
          ${chunk.index},
          ${vectorLiteral}::vector,
          ${JSON.stringify(args.metadata ?? {})}::jsonb
        )
    `;
  }
}

export async function retrieveKnowledgeChunks(args: {
  question: string;
  topK?: number;
  queryVariants?: string[];
}) {
  await ensureAssistantKnowledgeChunksTable();
  const topK = Math.max(1, Math.min(20, args.topK ?? 8));
  const variants = Array.from(
    new Set([String(args.question || "").trim(), ...(args.queryVariants ?? [])]),
  ).filter(Boolean);
  const vectorRows: RetrievedChunk[] = [];
  const vectorTopK = Math.max(topK, 12);
  const vectorQueries = variants.slice(0, 6);
  for (const q of vectorQueries) {
    const questionVector = await createEmbedding(q);
    const vectorLiteral = toVectorLiteral(questionVector);
    const rows = await sql<RetrievedChunk>`
      SELECT
        c.doc_id,
        c.title,
        c.content,
        c.content_norm,
        c.chunk_index,
        (1 - (c.embedding <=> ${vectorLiteral}::vector))::float8 AS similarity
      FROM public.assistant_knowledge_chunks c
      JOIN public.assistant_knowledge_docs d ON d.id = c.doc_id
      WHERE d.is_active = TRUE
      ORDER BY c.embedding <=> ${vectorLiteral}::vector ASC
      LIMIT ${vectorTopK}
    `;
    vectorRows.push(...rows);
  }

  const keywordNeedles = variants
    .map((v) => normalizeForSearch(v))
    .join(" ")
    .trim();
  const ftsRows =
    keywordNeedles.length > 0
      ? await sql<RetrievedChunk>`
          SELECT
            c.doc_id,
            c.title,
            c.content,
            c.content_norm,
            c.chunk_index,
            ts_rank_cd(
              to_tsvector('simple', c.content_norm),
              plainto_tsquery('simple', ${keywordNeedles})
            )::float8 AS similarity
          FROM public.assistant_knowledge_chunks c
          JOIN public.assistant_knowledge_docs d ON d.id = c.doc_id
          WHERE d.is_active = TRUE
            AND to_tsvector('simple', c.content_norm) @@ plainto_tsquery('simple', ${keywordNeedles})
          ORDER BY similarity DESC
          LIMIT ${vectorTopK}
        `
      : [];

  const merged = new Map<string, RetrievedChunk>();
  for (const row of [...vectorRows, ...ftsRows]) {
    const key = `${row.doc_id}:${row.chunk_index}`;
    const current = merged.get(key);
    if (!current || Number(row.similarity ?? 0) > Number(current.similarity ?? 0)) {
      merged.set(key, row);
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => Number(b.similarity ?? 0) - Number(a.similarity ?? 0))
    .slice(0, topK);
}
