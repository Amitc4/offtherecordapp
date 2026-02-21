
-- Trade offers table
CREATE TABLE public.trade_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id INTEGER NOT NULL,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  cash_amount NUMERIC DEFAULT 0,
  cash_direction TEXT DEFAULT 'none' CHECK (cash_direction IN ('none', 'sender_pays', 'receiver_pays')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed')),
  sender_confirmed BOOLEAN NOT NULL DEFAULT false,
  receiver_confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Items in a trade offer (records from either user)
CREATE TABLE public.trade_offer_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES public.trade_offers(id) ON DELETE CASCADE,
  record_id UUID NOT NULL REFERENCES public.user_records(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User reviews after completed trades
CREATE TABLE public.user_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES public.trade_offers(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  reviewed_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: one review per user per offer
ALTER TABLE public.user_reviews ADD CONSTRAINT unique_review_per_offer UNIQUE (offer_id, reviewer_id);

-- Enable RLS
ALTER TABLE public.trade_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_offer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reviews ENABLE ROW LEVEL SECURITY;

-- trade_offers policies
CREATE POLICY "Users can view own offers" ON public.trade_offers FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create offers" ON public.trade_offers FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Participants can update offers" ON public.trade_offers FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- trade_offer_items policies
CREATE POLICY "Users can view offer items" ON public.trade_offer_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.trade_offers WHERE id = offer_id
    AND (sender_id = auth.uid() OR receiver_id = auth.uid())
  ));

CREATE POLICY "Offer sender can insert items" ON public.trade_offer_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.trade_offers WHERE id = offer_id AND sender_id = auth.uid()
  ));

-- user_reviews policies
CREATE POLICY "Anyone can view reviews" ON public.user_reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can create reviews for completed offers" ON public.user_reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM public.trade_offers
      WHERE id = offer_id AND status = 'completed'
      AND (sender_id = auth.uid() OR receiver_id = auth.uid())
    )
  );

-- Updated_at trigger for trade_offers
CREATE TRIGGER update_trade_offers_updated_at
  BEFORE UPDATE ON public.trade_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for trade_offers
ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_offers;
