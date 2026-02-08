-- [Dalbus v2.0] Supabase Migration Script - Part 10: Update Order Accounts for Slots
-- Add slot_number and slot_password to order_accounts
ALTER TABLE order_accounts ADD COLUMN IF NOT EXISTS slot_number INTEGER;
ALTER TABLE order_accounts ADD COLUMN IF NOT EXISTS slot_password TEXT;

-- Add index/unique constraint if necessary?
-- Ideally (account_id, slot_number) should be unique for active assignments.
-- But since order_accounts is a log (history?), maybe not unique?
-- Wait, the table definition says "order_accounts: 주문-계정 매핑 로그" (Mapping Log).
-- If it's a log, we might have multiple rows.
-- However, currently we are treating it as active assignments.
-- Let's check Schema Part 1: "order_accounts" has "assigned_at".
-- If we want to prevent double assignment to same slot, we might want a unique index on (account_id, slot_number) where ... order is active?
-- For now, let's just add the columns.
