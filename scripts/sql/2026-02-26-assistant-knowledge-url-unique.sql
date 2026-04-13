ALTER TABLE public.assistant_knowledge_docs
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_assistant_knowledge_docs_url_source_ref
ON public.assistant_knowledge_docs ((metadata->>'sourceRef'))
WHERE source_type = 'url' AND COALESCE(metadata->>'sourceRef', '') <> '';
