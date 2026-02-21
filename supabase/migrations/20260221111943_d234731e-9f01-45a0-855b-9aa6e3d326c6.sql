-- Add status column to user_records for marking records
ALTER TABLE public.user_records 
ADD COLUMN status text NOT NULL DEFAULT 'personal';

-- Add index for filtering by status
CREATE INDEX idx_user_records_status ON public.user_records(status);