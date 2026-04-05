
-- Grading history table
CREATE TABLE public.grading_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  record_id UUID REFERENCES public.user_records(id) ON DELETE SET NULL,
  record_title TEXT,
  record_artist TEXT,
  grade TEXT,
  grade_label TEXT,
  confidence NUMERIC,
  summary TEXT,
  details JSONB,
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.grading_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own grading history" ON public.grading_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own grading history" ON public.grading_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own grading history" ON public.grading_history
  FOR DELETE USING (auth.uid() = user_id);

-- Support inquiries table
CREATE TABLE public.support_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  admin_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inquiries" ON public.support_inquiries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own inquiries" ON public.support_inquiries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all inquiries" ON public.support_inquiries
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update inquiries" ON public.support_inquiries
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_support_inquiries_updated_at
  BEFORE UPDATE ON public.support_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
