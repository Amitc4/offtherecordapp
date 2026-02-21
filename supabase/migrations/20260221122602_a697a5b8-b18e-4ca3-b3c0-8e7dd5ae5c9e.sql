-- Drop the correctly named public SELECT policy
DROP POLICY IF EXISTS "Record photos are publicly readable" ON storage.objects;

-- Also drop the wrong-name one for cleanup
DROP POLICY IF EXISTS "Anyone can view record photos" ON storage.objects;