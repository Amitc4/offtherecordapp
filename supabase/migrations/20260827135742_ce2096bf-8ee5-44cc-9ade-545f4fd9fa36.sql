-- Remove blanket EXECUTE from PUBLIC/anon on all SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_read_grading_object(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_read_upload_object(text) FROM PUBLIC, anon;

-- Keep them callable by signed-in users (needed by RLS policies) and backend
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_grading_object(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_upload_object(text) TO authenticated, service_role;

-- Trigger-only functions: nobody should call these directly
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dispatch_chat_message_push() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dispatch_push_notification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_friend_accepted() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_friend_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_trade_offer() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_wishlist_matches() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unarchive_chat_on_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_short_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;