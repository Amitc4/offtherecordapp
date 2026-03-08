
-- Replace the overly permissive insert policy with a restrictive one
-- The trigger function runs as SECURITY DEFINER so it bypasses RLS anyway
DROP POLICY "System can insert notifications" ON public.notifications;

CREATE POLICY "Authenticated users can insert own notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
