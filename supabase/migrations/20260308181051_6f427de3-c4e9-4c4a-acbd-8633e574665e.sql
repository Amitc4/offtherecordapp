
-- Notifications table for wishlist matching
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'wishlist_match',
  title text NOT NULL,
  body text,
  record_id uuid REFERENCES public.user_records(id) ON DELETE CASCADE,
  from_user_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- User reports table
CREATE TABLE public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  reported_id uuid NOT NULL,
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports" ON public.user_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports" ON public.user_reports
  FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports" ON public.user_reports
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reports" ON public.user_reports
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- User blocks table
CREATE TABLE public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blocks" ON public.user_blocks
  FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "Users can insert own blocks" ON public.user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can delete own blocks" ON public.user_blocks
  FOR DELETE USING (auth.uid() = blocker_id);

-- Record photos table
CREATE TABLE public.record_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.user_records(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.record_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own record photos" ON public.record_photos
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_records WHERE id = record_photos.record_id AND user_id = auth.uid()
  ));

CREATE POLICY "Anyone can view photos of for_sale records" ON public.record_photos
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.user_records WHERE id = record_photos.record_id AND status = 'for_sale'
  ));

CREATE POLICY "Owners can view own record photos" ON public.record_photos
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.user_records WHERE id = record_photos.record_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own record photos" ON public.record_photos
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.user_records WHERE id = record_photos.record_id AND user_id = auth.uid()
  ));

-- Add location columns to profiles
ALTER TABLE public.profiles ADD COLUMN latitude double precision;
ALTER TABLE public.profiles ADD COLUMN longitude double precision;

-- Wishlist match trigger function
CREATE OR REPLACE FUNCTION public.notify_wishlist_matches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'for_sale' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'for_sale') THEN
    INSERT INTO public.notifications (user_id, type, title, body, record_id, from_user_id)
    SELECT 
      w.user_id,
      'wishlist_match',
      'Wanted record available!',
      NEW.title || ' by ' || NEW.artist || ' is now for sale',
      NEW.id,
      NEW.user_id
    FROM public.user_wishlist w
    WHERE w.user_id != NEW.user_id
      AND (
        (w.discogs_release_id IS NOT NULL AND w.discogs_release_id = NEW.discogs_release_id)
        OR (LOWER(w.title) = LOWER(NEW.title) AND LOWER(w.artist) = LOWER(NEW.artist))
      );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_record_for_sale
  AFTER INSERT OR UPDATE ON public.user_records
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_wishlist_matches();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
