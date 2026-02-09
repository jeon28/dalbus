-- [Dalbus v2.2] Update Tidal Fields
-- Add payment_day to accounts table
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS payment_day INTEGER DEFAULT 1;

-- Add tidal_id to order_accounts table
ALTER TABLE public.order_accounts ADD COLUMN IF NOT EXISTS tidal_id TEXT;
