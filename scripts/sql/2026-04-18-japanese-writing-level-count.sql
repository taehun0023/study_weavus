ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS japanese_level TEXT;

UPDATE public.users
SET japanese_level = 'N3'
WHERE japanese_level IS NULL OR japanese_level = '';

ALTER TABLE public.users
  ALTER COLUMN japanese_level SET DEFAULT 'N3';

ALTER TABLE public.users
  ALTER COLUMN japanese_level SET NOT NULL;

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

ALTER TABLE public.japanese_writing_history
  ADD COLUMN IF NOT EXISTS prompt_id TEXT NOT NULL DEFAULT '';
ALTER TABLE public.japanese_writing_history
  ADD COLUMN IF NOT EXISTS is_correct BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.japanese_writing_history
  ADD COLUMN IF NOT EXISTS counted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.japanese_writing_history
  ADD COLUMN IF NOT EXISTS count_reason TEXT NOT NULL DEFAULT 'INCORRECT';
ALTER TABLE public.japanese_writing_history
  ADD COLUMN IF NOT EXISTS counted_key TEXT NULL;

CREATE TABLE IF NOT EXISTS public.japanese_writing_daily_counts (
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  count_date DATE NOT NULL,
  count_value INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, count_date)
);

CREATE INDEX IF NOT EXISTS idx_japanese_writing_history_user_date_counted
  ON public.japanese_writing_history (user_id, created_at DESC, counted);

CREATE UNIQUE INDEX IF NOT EXISTS uq_japanese_writing_history_counted_key
  ON public.japanese_writing_history (counted_key)
  WHERE counted_key IS NOT NULL;

