-- DATA CLEANSING SCRIPT FOR DALBUS
-- Target Tables: profiles, orders, order_accounts
-- Target Project: etfoluotiejftyqbourd

BEGIN;

-- 1. Normalize Phone Numbers in profiles
UPDATE profiles
SET phone = 
  CASE 
    WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^010[0-9]{8}$' 
    THEN regexp_replace(regexp_replace(phone, '[^0-9]', '', 'g'), '^([0-9]{3})([0-9]{4})([0-9]{4})$', '\1-\2-\3')
    WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^010[0-9]{7}$'
    THEN regexp_replace(regexp_replace(phone, '[^0-9]', '', 'g'), '^([0-9]{3})([0-9]{3})([0-9]{4})$', '\1-\2-\3')
    ELSE regexp_replace(phone, '[^0-9]', '', 'g')
  END
WHERE phone IS NOT NULL AND phone != '';

-- 2. Normalize Phone Numbers in orders
UPDATE orders
SET buyer_phone = 
  CASE 
    WHEN regexp_replace(buyer_phone, '[^0-9]', '', 'g') ~ '^010[0-9]{8}$' 
    THEN regexp_replace(regexp_replace(buyer_phone, '[^0-9]', '', 'g'), '^([0-9]{3})([0-9]{4})([0-9]{4})$', '\1-\2-\3')
    WHEN regexp_replace(buyer_phone, '[^0-9]', '', 'g') ~ '^010[0-9]{7}$'
    THEN regexp_replace(regexp_replace(buyer_phone, '[^0-9]', '', 'g'), '^([0-9]{3})([0-9]{3})([0-9]{4})$', '\1-\2-\3')
    ELSE regexp_replace(buyer_phone, '[^0-9]', '', 'g')
  END
WHERE buyer_phone IS NOT NULL AND buyer_phone != '';

-- 3. Normalize Phone Numbers in order_accounts
UPDATE order_accounts
SET buyer_phone = 
  CASE 
    WHEN regexp_replace(buyer_phone, '[^0-9]', '', 'g') ~ '^010[0-9]{8}$' 
    THEN regexp_replace(regexp_replace(buyer_phone, '[^0-9]', '', 'g'), '^([0-9]{3})([0-9]{4})([0-9]{4})$', '\1-\2-\3')
    WHEN regexp_replace(buyer_phone, '[^0-9]', '', 'g') ~ '^010[0-9]{7}$'
    THEN regexp_replace(regexp_replace(buyer_phone, '[^0-9]', '', 'g'), '^([0-9]{3})([0-9]{3})([0-9]{4})$', '\1-\2-\3')
    ELSE regexp_replace(buyer_phone, '[^0-9]', '', 'g')
  END
WHERE buyer_phone IS NOT NULL AND buyer_phone != '';

-- 4. Normalize Birth Dates in profiles (YYYY.MM.DD -> YYYY-MM-DD)
UPDATE profiles
SET birth_date = replace(birth_date, '.', '-')
WHERE birth_date IS NOT NULL AND birth_date ~ '^[0-9]{4}\.[0-9]{2}\.[0-9]{2}$';

-- 5. Standardize TIDAL IDs to lowercase (for search consistency)
UPDATE order_accounts
SET tidal_id = lower(tidal_id)
WHERE tidal_id IS NOT NULL AND tidal_id != '';

-- 6. Tag Test Data (Marking in memo instead of deleting for safety)
UPDATE profiles
SET memo = COALESCE(memo, '') || ' [TEST_DATA_IDENTIFIED]'
WHERE (name ~* 'test|테스트|asdf' OR email ~* 'test|테스트|asdf')
AND memo !~ '\[TEST_DATA_IDENTIFIED\]';

COMMIT;
