-- 1. Private schema (not exposed to the Data API)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- 2. Recreate the SECURITY DEFINER helpers inside the private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION private.can_read_grading_object(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  OR EXISTS (
    SELECT 1
    FROM public.record_surface_scans rs
    JOIN public.user_records ur2 ON ur2.id = rs.record_id
    WHERE ur2.status IN ('for_sale', 'sold')
      AND (
        rs.overlay_url LIKE '%/record-photos/' || _object_name
        OR rs.raw_photo_url LIKE '%/record-photos/' || _object_name
      )
  )
$function$;

CREATE OR REPLACE FUNCTION private.can_read_upload_object(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.record_photos rp
    JOIN public.user_records ur ON ur.id = rp.record_id
    WHERE rp.photo_type = 'user_upload'
      AND ur.status IN ('for_sale', 'sold')
      AND rp.photo_url LIKE '%/record-photos/' || _object_name
  )
$function$;

REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.can_read_grading_object(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.can_read_upload_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_read_grading_object(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_read_upload_object(text) TO authenticated, service_role;

-- 3. Rebuild every policy that referenced the public helpers
DROP POLICY IF EXISTS "Admins can create requests" ON public.admin_requests;
CREATE POLICY "Admins can create requests" ON public.admin_requests
FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin') AND auth.uid() = requester_id);

DROP POLICY IF EXISTS "Main admins can update requests" ON public.admin_requests;
CREATE POLICY "Main admins can update requests" ON public.admin_requests
FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'main_admin'));

DROP POLICY IF EXISTS "Main admins can view all requests" ON public.admin_requests;
CREATE POLICY "Main admins can view all requests" ON public.admin_requests
FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'main_admin'));

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all surface scans" ON public.record_surface_scans;
CREATE POLICY "Admins can view all surface scans" ON public.record_surface_scans
FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'main_admin'));

DROP POLICY IF EXISTS "Admins can update inquiries" ON public.support_inquiries;
CREATE POLICY "Admins can update inquiries" ON public.support_inquiries
FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all inquiries" ON public.support_inquiries;
CREATE POLICY "Admins can view all inquiries" ON public.support_inquiries
FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update reports" ON public.user_reports;
CREATE POLICY "Admins can update reports" ON public.user_reports
FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all reports" ON public.user_reports;
CREATE POLICY "Admins can view all reports" ON public.user_reports
FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'))
WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Others can read grading photos of listed records" ON storage.objects;
CREATE POLICY "Others can read grading photos of listed records" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'record-photos'
  AND (storage.foldername(name))[2] = 'grading'
  AND private.can_read_grading_object(name)
);

DROP POLICY IF EXISTS "Others can read uploaded photos of listed records" ON storage.objects;
CREATE POLICY "Others can read uploaded photos of listed records" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'record-photos'
  AND COALESCE((storage.foldername(name))[2], '') <> 'grading'
  AND private.can_read_upload_object(name)
);

-- 4. Remove the publicly exposed copies
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.can_read_grading_object(text);
DROP FUNCTION IF EXISTS public.can_read_upload_object(text);