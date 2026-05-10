ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS last_read_p1 timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_read_p2 timestamptz NOT NULL DEFAULT now();