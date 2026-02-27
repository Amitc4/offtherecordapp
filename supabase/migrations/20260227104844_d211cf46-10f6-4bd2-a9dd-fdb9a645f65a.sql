-- Drop and recreate with correct role
DROP POLICY IF EXISTS "Users can upload record photos" ON storage.objects;
CREATE POLICY "Users can upload record photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'record-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own record photos" ON storage.objects;
CREATE POLICY "Users can delete own record photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'record-photos' AND (storage.foldername(name))[1] = auth.uid()::text);