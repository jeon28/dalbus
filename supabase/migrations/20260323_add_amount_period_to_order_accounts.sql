-- Add amount and period_months to order_accounts for HifiTidal standalone tracking
ALTER TABLE order_accounts ADD COLUMN IF NOT EXISTS amount INTEGER;
ALTER TABLE order_accounts ADD COLUMN IF NOT EXISTS period_months INTEGER;
