-- Fix Timezone issue for order sequence generation
-- [Dalbus v2.x] Update Order Number Logic (YYMMDDNN Format) with proper KST timezone
-- Ensures sequence behaves correctly between 00:00 and 09:00 KST

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
    today_prefix TEXT;
    seq_num INTEGER;
    kst_now TIMESTAMP;
BEGIN
    kst_now := CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul';

    -- 1. Generate prefix: (Year-2020) + MMDD using KST
    today_prefix := LPAD((EXTRACT(YEAR FROM kst_now) - 2020)::TEXT, 2, '0') || TO_CHAR(kst_now, 'MMDD');

    -- 2. Calculate sequence number for the day using KST
    SELECT COUNT(*) + 1 INTO seq_num
    FROM orders
    WHERE TO_CHAR(created_at AT TIME ZONE 'Asia/Seoul', 'YYMMDD') = TO_CHAR(kst_now, 'YYMMDD');

    -- 3. Combine prefix and sequence (pad to 2 digits)
    NEW.order_number := today_prefix || LPAD(seq_num::TEXT, 2, '0');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
