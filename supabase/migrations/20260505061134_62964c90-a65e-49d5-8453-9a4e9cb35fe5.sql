ALTER TABLE public.grading_history
ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT '{}'::text[];