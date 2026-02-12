-- Explicitly block all SELECT access to discogs_tokens table
CREATE POLICY "Block all SELECT on discogs_tokens" 
ON public.discogs_tokens 
FOR SELECT 
USING (false);