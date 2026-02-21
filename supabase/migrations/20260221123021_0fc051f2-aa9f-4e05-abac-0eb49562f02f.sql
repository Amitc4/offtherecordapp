CREATE TABLE public.admin_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  target_email TEXT NOT NULL,
  target_display_name TEXT NOT NULL,
  requested_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_requests ENABLE ROW LEVEL SECURITY;

-- Main admins can view all requests
CREATE POLICY "Main admins can view all requests" 
  ON public.admin_requests
  FOR SELECT 
  USING (has_role(auth.uid(), 'main_admin'));

-- Admins can create requests
CREATE POLICY "Admins can create requests" 
  ON public.admin_requests
  FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'admin') AND auth.uid() = requester_id);

-- Main admins can update requests
CREATE POLICY "Main admins can update requests" 
  ON public.admin_requests
  FOR UPDATE 
  USING (has_role(auth.uid(), 'main_admin'));