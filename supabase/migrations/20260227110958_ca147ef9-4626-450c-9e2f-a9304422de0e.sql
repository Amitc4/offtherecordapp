-- Add genre column to user_records
ALTER TABLE public.user_records ADD COLUMN IF NOT EXISTS genre text;

-- Allow all authenticated users to view records that are for_sale (marketplace)
CREATE POLICY "Anyone can view for_sale records"
ON public.user_records FOR SELECT
TO authenticated
USING (status = 'for_sale');