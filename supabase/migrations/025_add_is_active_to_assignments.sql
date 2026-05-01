-- ============================================
-- [Dalbus v3.1] Add is_active to order_accounts
-- ============================================
-- Migration 025
-- Purpose: Support soft-delete/deactivation of assignments to allow slot reuse while keeping history.
-- ============================================

-- 1. Add is_active column (Default true)
ALTER TABLE public.order_accounts
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN order_accounts.is_active IS 'If false, this assignment is considered history/inactive and does not block the slot.';

-- 2. Drop existing unique constraints
-- We need to check constraint names from previous migrations (020_add_unique_tidal_id.sql)
-- Names were: order_accounts_tidal_id_key, order_accounts_account_slot_key

ALTER TABLE public.order_accounts
DROP CONSTRAINT IF EXISTS order_accounts_tidal_id_key;

ALTER TABLE public.order_accounts
DROP CONSTRAINT IF EXISTS order_accounts_account_slot_key;

-- 3. Create Partial Unique Indexes
-- Only enforce uniqueness for ACTIVE assignments.
-- This allows:
--  - Multiple rows with same tidal_id (e.g. 1 active, 5 inactive history)
--  - Multiple rows with same (account_id, slot_number) (e.g. 1 active, 10 inactive history)

CREATE UNIQUE INDEX order_accounts_tidal_id_active_idx
ON public.order_accounts (tidal_id)
WHERE is_active = true;

CREATE UNIQUE INDEX order_accounts_account_slot_active_idx
ON public.order_accounts (account_id, slot_number)
WHERE is_active = true;
