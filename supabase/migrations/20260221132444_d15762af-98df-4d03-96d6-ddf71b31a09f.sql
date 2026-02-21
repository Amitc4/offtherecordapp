
-- Replace single cash_amount/cash_direction with per-side cash amounts
ALTER TABLE public.trade_offers DROP COLUMN cash_direction;
ALTER TABLE public.trade_offers RENAME COLUMN cash_amount TO sender_cash;
ALTER TABLE public.trade_offers ADD COLUMN receiver_cash NUMERIC NOT NULL DEFAULT 0;
-- Remove the old check constraint if any
ALTER TABLE public.trade_offers DROP CONSTRAINT IF EXISTS trade_offers_cash_direction_check;
