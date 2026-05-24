BEGIN;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS match_code TEXT,
    ADD COLUMN IF NOT EXISTS assigned_bank_account_id UUID REFERENCES bank_accounts(id),
    ADD COLUMN IF NOT EXISTS payment_due_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS orders_match_code_unique
    ON orders (match_code)
    WHERE match_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_assigned_bank_account_idx
    ON orders (assigned_bank_account_id);

CREATE INDEX IF NOT EXISTS orders_payment_due_at_idx
    ON orders (payment_due_at)
    WHERE payment_status = 'pending';

CREATE OR REPLACE FUNCTION generate_match_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    code TEXT;
    attempt INT := 0;
    max_attempts INT := 20;
BEGIN
    LOOP
        code := '';
        FOR i IN 1..4 LOOP
            code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
        END LOOP;

        IF NOT EXISTS (
            SELECT 1 FROM orders
            WHERE match_code = code
              AND payment_status IN ('pending')
        ) THEN
            RETURN code;
        END IF;

        attempt := attempt + 1;
        IF attempt >= max_attempts THEN
            code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
            RETURN code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_order_payment_defaults()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.match_code IS NULL THEN
        NEW.match_code := generate_match_code();
    END IF;

    IF NEW.payment_due_at IS NULL THEN
        NEW.payment_due_at := NOW() + INTERVAL '48 hours';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_payment_defaults_trigger ON orders;
CREATE TRIGGER orders_payment_defaults_trigger
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION set_order_payment_defaults();

UPDATE orders
SET match_code = generate_match_code()
WHERE match_code IS NULL
  AND payment_status = 'pending';

UPDATE orders
SET payment_due_at = COALESCE(created_at, NOW()) + INTERVAL '48 hours'
WHERE payment_due_at IS NULL
  AND payment_status = 'pending';

COMMIT;
