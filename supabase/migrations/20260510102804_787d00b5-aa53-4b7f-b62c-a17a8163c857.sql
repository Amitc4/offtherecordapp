-- Allow participants to delete their chats and cascade-related rows
CREATE POLICY "Participants can delete own chats"
ON public.chats FOR DELETE TO authenticated
USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Participants can delete chat messages"
ON public.chat_messages FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.chats c
  WHERE c.id = chat_messages.chat_id
    AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
));

CREATE POLICY "Participants can delete trade offers"
ON public.trade_offers FOR DELETE TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Participants can delete trade offer items"
ON public.trade_offer_items FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.trade_offers o
  WHERE o.id = trade_offer_items.offer_id
    AND (o.sender_id = auth.uid() OR o.receiver_id = auth.uid())
));

-- Trigger: when a new message is inserted, remove all participants except the sender
-- from the chat's archived_by array, so it returns to their active inbox.
CREATE OR REPLACE FUNCTION public.unarchive_chat_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chats
  SET archived_by = ARRAY(
        SELECT unnest(archived_by)
        EXCEPT
        SELECT unnest(ARRAY[participant_1, participant_2])
        EXCEPT
        SELECT NEW.sender_id
      ),
      updated_at = now()
  WHERE id = NEW.chat_id
    AND archived_by IS NOT NULL
    AND array_length(archived_by, 1) > 0;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS unarchive_chat_on_message_trigger ON public.chat_messages;
CREATE TRIGGER unarchive_chat_on_message_trigger
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.unarchive_chat_on_message();