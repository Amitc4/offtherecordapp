ALTER TABLE public.record_surface_scans
  ADD COLUMN IF NOT EXISTS overlay_url text,
  ADD COLUMN IF NOT EXISTS raw_photo_url text,
  ADD COLUMN IF NOT EXISTS history_id uuid REFERENCES public.grading_history(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_record_surface_scans_history ON public.record_surface_scans (history_id);