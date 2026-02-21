-- Make record-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'record-photos';

-- Drop the public SELECT policy
DROP POLICY IF EXISTS "Anyone can view record photos" ON storage.objects;