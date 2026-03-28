-- Create legacy_tidal_account table for standalone HifiTidal account tracking
-- This mirrors order_accounts but has no dependency on the orders table.

CREATE TABLE IF NOT EXISTS public.legacy_tidal_account (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    slot_number INTEGER NOT NULL DEFAULT 0,
    tidal_password TEXT,
    tidal_id TEXT,
    type TEXT NOT NULL DEFAULT 'user', -- 'master' | 'user'
    buyer_name TEXT,
    buyer_phone TEXT,
    buyer_email TEXT,
    order_number TEXT,
    start_date DATE,
    end_date DATE,
    period_months INTEGER,
    amount INTEGER,
    memo TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Unique active tidal_id per table
CREATE UNIQUE INDEX IF NOT EXISTS legacy_tidal_account_tidal_id_active_idx
    ON public.legacy_tidal_account (tidal_id)
    WHERE is_active = true AND tidal_id IS NOT NULL;

-- Unique active slot per account
CREATE UNIQUE INDEX IF NOT EXISTS legacy_tidal_account_account_slot_active_idx
    ON public.legacy_tidal_account (account_id, slot_number)
    WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.legacy_tidal_account ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (admin operations use supabaseAdmin which bypasses RLS)
CREATE POLICY "Service role full access to legacy_tidal_account"
    ON public.legacy_tidal_account
    USING (true)
    WITH CHECK (true);
