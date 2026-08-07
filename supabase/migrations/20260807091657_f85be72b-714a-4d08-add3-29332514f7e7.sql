CREATE OR REPLACE FUNCTION public.can_read_grading_object(_object_name text)
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