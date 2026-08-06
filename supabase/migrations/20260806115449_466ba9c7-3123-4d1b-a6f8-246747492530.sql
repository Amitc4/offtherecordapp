CREATE TABLE public.record_surface_scans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  record_id uuid REFERENCES public.user_records(id) ON DELETE CASCADE,
  side text NOT NULL,
  analysis_id text,
  grade text,
  mark_count integer,
  judged_pct numeric,
  marks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.record_surface_scans TO authenticated;
GRANT ALL ON public.record_surface_scans TO service_role;

ALTER TABLE public.record_surface_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own surface scans"
ON public.record_surface_scans FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all surface scans"
ON public.record_surface_scans FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'main_admin'));

CREATE INDEX idx_record_surface_scans_record ON public.record_surface_scans (record_id);
CREATE INDEX idx_record_surface_scans_user ON public.record_surface_scans (user_id);