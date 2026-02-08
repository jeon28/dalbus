-- [Dalbus v2.0] Supabase Migration Script - Part 9: Update Accounts Table
-- Add payment_email for Master Payment ID
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS payment_email TEXT;

-- ensure default max_slots is 6
ALTER TABLE accounts ALTER COLUMN max_slots SET DEFAULT 6;
