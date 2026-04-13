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
);

ALTER TABLE public.japanese_writing_history
  ADD COLUMN IF NOT EXISTS prompt_ko TEXT NOT NULL DEFAULT '';
ALTER TABLE public.japanese_writing_history
  ADD COLUMN IF NOT EXISTS user_text TEXT NOT NULL DEFAULT '';
ALTER TABLE public.japanese_writing_history
  ADD COLUMN IF NOT EXISTS corrected_text TEXT NOT NULL DEFAULT '';
ALTER TABLE public.japanese_writing_history
  ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT 'fix';
ALTER TABLE public.japanese_writing_history
  ADD COLUMN IF NOT EXISTS comment TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_japanese_writing_history_user_created_at
  ON public.japanese_writing_history (user_id, created_at DESC);
