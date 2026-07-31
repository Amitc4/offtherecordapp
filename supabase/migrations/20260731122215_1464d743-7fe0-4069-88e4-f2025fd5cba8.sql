DROP TRIGGER IF EXISTS trg_notify_wishlist_matches_ins ON public.user_records;
DROP TRIGGER IF EXISTS trg_notify_wishlist_matches_upd ON public.user_records;

CREATE OR REPLACE FUNCTION public.notify_wishlist_matches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'for_sale' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'for_sale') THEN
    INSERT INTO public.notifications (user_id, type, title, body, record_id, from_user_id)
    SELECT DISTINCT
      w.user_id,
      'wishlist_match',
      'Wanted record available!',
      NEW.title || ' by ' || NEW.artist || ' is now for sale',
      NEW.id,
      NEW.user_id
    FROM public.user_wishlist w
    WHERE w.user_id <> NEW.user_id
      AND (
        (w.discogs_release_id IS NOT NULL AND NEW.discogs_release_id IS NOT NULL
          AND w.discogs_release_id = NEW.discogs_release_id)
        OR (
          LOWER(BTRIM(w.title)) = LOWER(BTRIM(NEW.title))
          AND LOWER(BTRIM(w.artist)) = LOWER(BTRIM(NEW.artist))
        )
      );
  END IF;
  RETURN NEW;
END;
$function$;