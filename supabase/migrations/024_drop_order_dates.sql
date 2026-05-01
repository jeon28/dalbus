-- Remove start_date and end_date from orders table as they are now managed in order_accounts
ALTER TABLE orders
DROP COLUMN IF EXISTS start_date,
DROP COLUMN IF EXISTS end_date;
