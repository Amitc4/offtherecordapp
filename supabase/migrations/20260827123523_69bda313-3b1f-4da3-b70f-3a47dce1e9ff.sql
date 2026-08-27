CREATE OR REPLACE FUNCTION public.notify_friend_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, nickname, 'Someone') INTO sender_name
  FROM public.profiles WHERE user_id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, from_user_id, read)
  VALUES (
    NEW.friend_id,
    'friend_request',
    'New friend request',
    COALESCE(sender_name, 'Someone') || ' wants to be your friend',
    NEW.user_id,
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_friend_request ON public.friends;
CREATE TRIGGER trg_notify_friend_request
AFTER INSERT ON public.friends
FOR EACH ROW EXECUTE FUNCTION public.notify_friend_request();