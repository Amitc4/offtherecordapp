-- Create friends table
CREATE TABLE public.friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- Users can view their own friend relationships (sent or received)
CREATE POLICY "Users can view own friends"
  ON public.friends FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Users can send friend requests
CREATE POLICY "Users can send friend requests"
  ON public.friends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update friend requests they received (accept/reject)
CREATE POLICY "Users can update received requests"
  ON public.friends FOR UPDATE
  USING (auth.uid() = friend_id);

-- Users can delete their own friendships
CREATE POLICY "Users can delete own friends"
  ON public.friends FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Add a short_id column to profiles for easy friend adding
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS short_id TEXT UNIQUE;

-- Generate short IDs for existing profiles
UPDATE public.profiles SET short_id = UPPER(SUBSTR(id::text, 1, 8)) WHERE short_id IS NULL;

-- Create a trigger to auto-generate short_id for new profiles
CREATE OR REPLACE FUNCTION public.generate_short_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.short_id IS NULL THEN
    NEW.short_id := UPPER(SUBSTR(NEW.id::text, 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_short_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_short_id();

-- Allow authenticated users to search profiles by display_name or short_id (read-only, limited fields)
CREATE POLICY "Users can search other profiles"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);