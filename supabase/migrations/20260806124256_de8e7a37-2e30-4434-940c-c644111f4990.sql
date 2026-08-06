-- 1. Distinguish photo categories in the database
ALTER TABLE public.record_photos
  ADD COLUMN IF NOT EXISTS photo_type text NOT NULL DEFAULT 'user_upload';

ALTER TABLE public.record_photos
  DROP CONSTRAINT IF EXISTS record_photos_photo_type_check;
ALTER TABLE public.record_photos
  ADD CONSTRAINT record_photos_photo_type_check
  CHECK (photo_type IN ('grading', 'user_upload'));

-- 2. Table-level SELECT policies on record_photos
DROP POLICY IF EXISTS "Anyone can view photos of for_sale records" ON public.record_photos;
DROP POLICY IF EXISTS "Others can view listed record photos" ON public.record_photos;

CREATE POLICY "Others can view listed record photos"
ON public.record_photos FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_records ur
    WHERE ur.id = record_photos.record_id
      AND ur.status IN ('for_sale', 'sold')
  )
);

-- 3. Security-definer helpers so storage policies can evaluate ownership/status
CREATE OR REPLACE FUNCTION public.can_read_grading_object(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.grading_history gh
    JOIN public.user_records ur ON ur.id = gh.record_id
    WHERE ur.status IN ('for_sale', 'sold')
      AND (
        EXISTS (
          SELECT 1 FROM unnest(COALESCE(gh.photo_urls, ARRAY[]::text[])) pu
          WHERE pu LIKE '%/record-photos/' || _object_name
        )
        OR gh.photo_url LIKE '%/record-photos/' || _object_name
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_read_upload_object(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.record_photos rp
    JOIN public.user_records ur ON ur.id = rp.record_id
    WHERE rp.photo_type = 'user_upload'
      AND ur.status IN ('for_sale', 'sold')
      AND rp.photo_url LIKE '%/record-photos/' || _object_name
  )
$$;

REVOKE ALL ON FUNCTION public.can_read_grading_object(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_upload_object(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_grading_object(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_upload_object(text) TO authenticated;

-- 4. Storage SELECT policies
DROP POLICY IF EXISTS "Authenticated users can read record photos" ON storage.objects;
DROP POLICY IF EXISTS "Owners can read own record photos" ON storage.objects;
DROP POLICY IF EXISTS "Others can read grading photos of listed records" ON storage.objects;
DROP POLICY IF EXISTS "Others can read uploaded photos of listed records" ON storage.objects;

CREATE POLICY "Owners can read own record photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'record-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Others can read grading photos of listed records"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'record-photos'
  AND (storage.foldername(name))[2] = 'grading'
  AND public.can_read_grading_object(name)
);

CREATE POLICY "Others can read uploaded photos of listed records"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'record-photos'
  AND COALESCE((storage.foldername(name))[2], '') <> 'grading'
  AND public.can_read_upload_object(name)
);