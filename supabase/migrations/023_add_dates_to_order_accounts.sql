-- Add start_date and end_date to order_accounts for tracking assignment validity
ALTER TABLE order_accounts
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Comment on columns
COMMENT ON COLUMN order_accounts.start_date IS 'Assignment start date (can differ from order start date)';
COMMENT ON COLUMN order_accounts.end_date IS 'Assignment end date (can differ from order end date)';

-- Backfill data from orders table
UPDATE order_accounts oa
SET
  start_date = o.start_date,
  end_date = o.end_date
FROM orders o
WHERE oa.order_id = o.id;
