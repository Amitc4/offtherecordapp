CREATE OR REPLACE FUNCTION public.dispatch_chat_message_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  recipient uuid;
  sender_name text;
BEGIN
  SELECT CASE WHEN c.participant_1 = NEW.sender_id THEN c.participant_2 ELSE c.participant_1 END
    INTO recipient
  FROM public.chats c WHERE c.id = NEW.chat_id;

  IF recipient IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, nickname, 'New message') INTO sender_name
  FROM public.profiles WHERE user_id = NEW.sender_id;

  PERFORM net.http_post(
    url := 'https://zdfsqhrfnkdwtyipfisb.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', '6247440f425fc89f6f4af30708ee821e3cbc52629c36ff29'
    ),
    body := jsonb_build_object(
      'user_id', recipient,
      'type', 'chat_message',
      'title', COALESCE(sender_name, 'New message'),
      'body', LEFT(NEW.text, 120),
      'from_user_id', NEW.sender_id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_chat_message_push ON public.chat_messages;
CREATE TRIGGER on_chat_message_push
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.dispatch_chat_message_push();