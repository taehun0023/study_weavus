CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.assistant_knowledge_docs
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.assistant_knowledge_chunks (
  id BIGSERIAL PRIMARY KEY,
  doc_id BIGINT NOT NULL REFERENCES public.assistant_knowledge_docs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_norm TEXT NOT NULL DEFAULT '',
  chunk_index INTEGER NOT NULL DEFAULT 0,
  embedding vector(1536) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.assistant_knowledge_chunks
ADD COLUMN IF NOT EXISTS content_norm TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_chunks_doc_id
  ON public.assistant_knowledge_chunks(doc_id);

CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_chunks_content_norm
  ON public.assistant_knowledge_chunks USING gin (to_tsvector('simple', content_norm));

CREATE TABLE IF NOT EXISTS public.assistant_ingestion_logs (
  id BIGSERIAL PRIMARY KEY,
  level TEXT NOT NULL,
  stage TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
