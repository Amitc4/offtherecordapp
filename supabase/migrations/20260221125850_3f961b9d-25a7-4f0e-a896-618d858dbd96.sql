-- Allow users to view records of their accepted friends
CREATE POLICY "Users can view friends records"
ON public.user_records FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.friends
    WHERE status = 'accepted'
    AND (
      (friends.user_id = auth.uid() AND friends.friend_id = user_records.user_id)
      OR
      (friends.friend_id = auth.uid() AND friends.user_id = user_records.user_id)
    )
  )
);