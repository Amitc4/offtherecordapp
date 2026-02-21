-- Add price column to user_records for listing price
ALTER TABLE public.user_records 
ADD COLUMN price numeric(10,2) DEFAULT NULL;