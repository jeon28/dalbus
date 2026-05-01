-- [Dalbus v2.x] Update Order Number Format (8 Digits Random)

-- 1. Drop existing trigger and function
DROP TRIGGER IF EXISTS orders_number_trigger ON orders;
DROP FUNCTION IF EXISTS generate_order_number();

-- 2. Create new function for 8-digit random order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
    new_order_num TEXT;
    is_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate 8 digit random number (10000000 ~ 99999999)
        new_order_num := floor(random() * 90000000 + 10000000)::text;
        
        -- Check if exists in orders table
        SELECT EXISTS(SELECT 1 FROM orders WHERE order_number = new_order_num) INTO is_exists;
        
        -- If unique, break loop
        IF NOT is_exists THEN
            EXIT;
        END IF;
    END LOOP;
    
    NEW.order_number := new_order_num;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Re-create trigger
CREATE TRIGGER orders_number_trigger
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION generate_order_number();
