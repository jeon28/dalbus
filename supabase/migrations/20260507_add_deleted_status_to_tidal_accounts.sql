-- Ensure 'deleted' is a valid status value for tidal_accounts
-- account_status enum already has 'deleted' from migration 20260323
-- This migration is a safety check in case tidal_accounts uses a separate enum or text field
ALTER TYPE account_status ADD VALUE IF NOT EXISTS 'deleted';
