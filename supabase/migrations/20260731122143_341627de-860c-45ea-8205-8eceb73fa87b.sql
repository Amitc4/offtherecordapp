DROP TRIGGER IF EXISTS trg_notify_wishlist_matches_ins ON public.user_records;
DROP TRIGGER IF EXISTS trg_notify_wishlist_matches_upd ON public.user_records;

CREATE TRIGGER trg_notify_wishlist_matches_ins
AFTER INSERT ON public.user_records
FOR EACH ROW EXECUTE FUNCTION public.notify_wishlist_matches();

CREATE TRIGGER trg_notify_wishlist_matches_upd
AFTER UPDATE OF status ON public.user_records
FOR EACH ROW EXECUTE FUNCTION public.notify_wishlist_matches();

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;