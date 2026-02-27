
-- Chats table (using serial id to match existing trade_offers.chat_id integer FK)
CREATE TABLE public.chats (
  id SERIAL PRIMARY KEY,
  participant_1 UUID NOT NULL,
  participant_2 UUID NOT NULL,
  record_id UUID REFERENCES public.user_records(id),
  record_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES public.chats(id),
  sender_id UUID NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS on chats
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view own chats"
  ON public.chats FOR SELECT
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Authenticated users can create chats"
  ON public.chats FOR INSERT
  WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Participants can update own chats"
  ON public.chats FOR UPDATE
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- RLS on chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view chat messages"
  ON public.chat_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = chat_messages.chat_id
    AND (chats.participant_1 = auth.uid() OR chats.participant_2 = auth.uid())
  ));

CREATE POLICY "Participants can send messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = chat_messages.chat_id
      AND (chats.participant_1 = auth.uid() OR chats.participant_2 = auth.uid())
    )
  );

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Update trigger for chats.updated_at
CREATE TRIGGER update_chats_updated_at
  BEFORE UPDATE ON public.chats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
