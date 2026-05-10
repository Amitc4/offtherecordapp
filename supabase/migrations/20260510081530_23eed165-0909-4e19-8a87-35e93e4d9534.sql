-- Spotify per-user OAuth tokens
CREATE TABLE public.spotify_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scope TEXT,
  spotify_user_id TEXT,
  spotify_display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.spotify_tokens ENABLE ROW LEVEL SECURITY;

-- Block all SELECT from clients (tokens read only by edge functions via service role)
CREATE POLICY "Block all SELECT on spotify_tokens"
ON public.spotify_tokens FOR SELECT USING (false);

CREATE POLICY "Users can insert own spotify tokens"
ON public.spotify_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own spotify tokens"
ON public.spotify_tokens FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own spotify tokens"
ON public.spotify_tokens FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_spotify_tokens_updated_at
BEFORE UPDATE ON public.spotify_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lightweight flag on profiles for UI display
ALTER TABLE public.profiles
  ADD COLUMN spotify_connected BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN spotify_username TEXT;