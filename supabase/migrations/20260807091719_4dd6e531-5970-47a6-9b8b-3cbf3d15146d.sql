CREATE POLICY "Anyone can view scans of listed records"
ON public.record_surface_scans
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_records ur
    WHERE ur.id = record_surface_scans.record_id
      AND ur.status IN ('for_sale', 'sold')
  )
);