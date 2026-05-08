-- Add soft-delete support to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS orders_is_deleted_idx ON orders(is_deleted);
