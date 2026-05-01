-- [Dalbus v2.x] Update Order Number Logic (YYMMDDNN Format)
-- YY: Year - 2020 (e.g., 2026 -> 06)
-- MM: Month (01-12)
-- DD: Day (01-31)
-- NN: Daily Sequence (01-99)

-- 1. Drop existing trigger and function
DROP TRIGGER IF EXISTS orders_number_trigger ON orders;
DROP FUNCTION IF EXISTS generate_order_number();

-- 2. Create new function for YYMMDDNN format
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
    today_prefix TEXT;
    seq_num INTEGER;
BEGIN
    -- 1. Generate prefix: (Year-2020) + MMDD
    -- LPAD(..., 2, '0') ensures we have 2 digits for each part
    today_prefix := LPAD((EXTRACT(YEAR FROM CURRENT_DATE) - 2020)::TEXT, 2, '0') || TO_CHAR(CURRENT_DATE, 'MMDD');

    -- 2. Calculate sequence number for the day
    -- We count total orders created today (local time)
    SELECT COUNT(*) + 1 INTO seq_num
    FROM orders
    WHERE TO_CHAR(created_at AT TIME ZONE 'Asia/Seoul', 'YYMMDD') = TO_CHAR(CURRENT_DATE, 'YYMMDD');

    -- 3. Combine prefix and sequence (pad to 2 digits)
    NEW.order_number := today_prefix || LPAD(seq_num::TEXT, 2, '0');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Re-create trigger
CREATE TRIGGER orders_number_trigger
    BEFORE INSERT ON orders
    FOR EACH ROW
    WHEN (NEW.order_number IS NULL)
    EXECUTE FUNCTION generate_order_number();
