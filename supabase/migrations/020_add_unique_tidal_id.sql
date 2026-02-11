-- ============================================
-- [Dalbus v2.6] Add unique constraints to order_accounts
-- ============================================
-- Migration 020
-- Created: 2026-02-11
-- Purpose: Prevent duplicate tidal_id and slot assignments
--
-- IMPORTANT: Run this migration in Supabase SQL Editor BEFORE Excel import
-- ============================================

-- 1. Check for duplicate tidal_id (cleanup required if any exist)
-- Uncomment below to see duplicates:
-- SELECT tidal_id, COUNT(*) as duplicate_count
-- FROM order_accounts
-- WHERE tidal_id IS NOT NULL AND tidal_id != ''
-- GROUP BY tidal_id
-- HAVING COUNT(*) > 1;

-- 2. Check for duplicate (account_id, slot_number)
-- Uncomment below to see duplicates:
-- SELECT account_id, slot_number, COUNT(*) as duplicate_count
-- FROM order_accounts
-- GROUP BY account_id, slot_number
-- HAVING COUNT(*) > 1;

-- ============================================
-- CONSTRAINT CREATION
-- ============================================

-- 3. Add UNIQUE constraint on tidal_id
-- This ensures: 1 Tidal ID = 1 Slot (no sharing)
ALTER TABLE public.order_accounts
ADD CONSTRAINT order_accounts_tidal_id_key UNIQUE (tidal_id);

-- 4. Add UNIQUE constraint on (account_id, slot_number)
-- This ensures: 1 Slot in a Master Account = 1 Assignment only
ALTER TABLE public.order_accounts
ADD CONSTRAINT order_accounts_account_slot_key UNIQUE (account_id, slot_number);

-- ============================================
-- VERIFICATION
-- ============================================

-- 5. Verify constraints are created
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'order_accounts'::regclass
AND conname IN ('order_accounts_tidal_id_key', 'order_accounts_account_slot_key');

-- Expected output:
-- constraint_name                      | definition
-- ------------------------------------+---------------------------------------
-- order_accounts_tidal_id_key         | UNIQUE (tidal_id)
-- order_accounts_account_slot_key     | UNIQUE (account_id, slot_number)

-- ============================================
-- NOTES
-- ============================================
-- - If constraint creation fails due to existing duplicates, clean up first:
--   DELETE FROM order_accounts WHERE id IN (
--     SELECT id FROM (
--       SELECT id, ROW_NUMBER() OVER (PARTITION BY tidal_id ORDER BY assigned_at ASC) as rn
--       FROM order_accounts
--       WHERE tidal_id IS NOT NULL
--     ) t WHERE rn > 1
--   );
--
-- - After this migration, Excel import will work correctly with upsert logic
-- - Rollback (if needed):
--   ALTER TABLE order_accounts DROP CONSTRAINT order_accounts_tidal_id_key;
--   ALTER TABLE order_accounts DROP CONSTRAINT order_accounts_account_slot_key;
