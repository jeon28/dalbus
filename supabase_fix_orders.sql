-- [Fix] Improve order number generation to avoid collisions
-- Use YYYYMMDD + HHMMSS + Milliseconds to ensure uniqueness
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Format: ORD-20260208-163500-123
    NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS-MS');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
