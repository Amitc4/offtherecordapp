CREATE OR REPLACE FUNCTION public.notify_trade_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
BEGIN
  SELECT COALESCE(display_name, nickname, 'Someone') INTO sender_name
  FROM public.profiles WHERE user_id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, title, body, from_user_id, read)
  VALUES (
    NEW.receiver_id,
    'trade_offer',
    'New trade offer',
    COALESCE(sender_name, 'Someone') || ' sent you a trade offer',
    NEW.sender_id,
    false
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_trade_offer ON public.trade_offers;
CREATE TRIGGER trg_notify_trade_offer
AFTER INSERT ON public.trade_offers
FOR EACH ROW EXECUTE FUNCTION public.notify_trade_offer();

CREATE OR REPLACE FUNCTION public.notify_friend_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accepter_name text;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    SELECT COALESCE(display_name, nickname, 'Someone') INTO accepter_name
    FROM public.profiles WHERE user_id = NEW.friend_id;

    INSERT INTO public.notifications (user_id, type, title, body, from_user_id, read)
    VALUES (
      NEW.user_id,
      'friend_accepted',
      'Friend request accepted',
      COALESCE(accepter_name, 'Someone') || ' accepted your friend request',
      NEW.friend_id,
      false
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_friend_accepted ON public.friends;
CREATE TRIGGER trg_notify_friend_accepted
AFTER UPDATE ON public.friends
FOR EACH ROW EXECUTE FUNCTION public.notify_friend_accepted();