ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "Users can search other profiles" ON public.profiles;

CREATE POLICY "Users can search discoverable profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (discoverable = true OR user_id = auth.uid())
  );