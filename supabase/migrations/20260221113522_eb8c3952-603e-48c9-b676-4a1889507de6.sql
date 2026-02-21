-- Create storage bucket for record photos
INSERT INTO storage.buckets (id, name, public) VALUES ('record-photos', 'record-photos', true);

-- Allow authenticated users to upload their own photos
CREATE POLICY "Users can upload record photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'record-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access for AI processing
CREATE POLICY "Record photos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'record-photos');

-- Allow users to delete their own photos
CREATE POLICY "Users can delete own record photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'record-photos' AND auth.uid()::text = (storage.foldername(name))[1]);