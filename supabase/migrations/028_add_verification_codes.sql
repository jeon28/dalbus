-- ============================================
-- [Dalbus v3.3] Add verification_codes table
-- ============================================
-- Migration 028
-- Created: 2026-02-23
-- Purpose: Store temporary OTPs for password recovery
-- ============================================

CREATE TABLE IF NOT EXISTS public.verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (strictly server-side)
CREATE POLICY "Service role only access" 
ON public.verification_codes 
FOR ALL 
TO service_role 
USING (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_verification_codes_email_expires ON public.verification_codes(email, expires_at);

-- Cleanup trigger (optional, or we can handle in API)
-- For simplicity, we'll just let them accumulate or manually clean up if needed.
-- But a cleanup policy is better:
COMMENT ON TABLE public.verification_codes IS 'Stores temporary 6-digit codes for password recovery. Expires in 10 minutes.';
