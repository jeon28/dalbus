-- [Dalbus v2.5] Allow null order_id for order_accounts
-- This supports importing legacy slots that are not tied to a specific order in the system.
ALTER TABLE public.order_accounts ALTER COLUMN order_id DROP NOT NULL;
