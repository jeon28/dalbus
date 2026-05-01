-- Add buyer information fields to order_accounts table
ALTER TABLE order_accounts
ADD COLUMN buyer_name TEXT,
ADD COLUMN buyer_phone TEXT,
ADD COLUMN buyer_email TEXT;

-- Add comment to explain these fields
COMMENT ON COLUMN order_accounts.buyer_name IS 'Buyer name for this slot (can be edited independently from order)';
COMMENT ON COLUMN order_accounts.buyer_phone IS 'Buyer phone for this slot (can be edited independently from order)';
COMMENT ON COLUMN order_accounts.buyer_email IS 'Buyer email for this slot (can be edited independently from order)';
