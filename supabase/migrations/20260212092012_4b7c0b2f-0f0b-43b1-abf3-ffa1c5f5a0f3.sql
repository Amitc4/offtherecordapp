-- Remove SELECT policy from discogs_tokens to prevent client-side access to OAuth credentials
-- Edge functions already use service_role to access tokens server-side
DROP POLICY IF EXISTS "Users can view own tokens" ON public.discogs_tokens;