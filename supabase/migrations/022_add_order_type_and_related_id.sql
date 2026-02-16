-- [Dalbus v2.8] Supabase Migration Script - Part 22: Add Order Type and Related Order ID
-- Date: 2026-02-16
-- Description: Add order_type ENUM ('NEW', 'EXT') and related_order_id for improved order tracking

-- 1. Create ENUM type for order_type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_type') THEN
        CREATE TYPE order_type AS ENUM ('NEW', 'EXT');
    END IF;
END $$;

-- 2. Add order_type column to orders table
-- Default to 'NEW' for existing rows to maintain data integrity
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_type order_type DEFAULT 'NEW';

-- Reduced default value requirement after initial population (if needed), 
-- but keeping default 'NEW' is generally safe for this logic.

-- 3. Add related_order_id column to orders table
-- This is a self-referencing foreign key to link extension orders to original orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

-- 4. Add index for faster lookups on related orders
CREATE INDEX IF NOT EXISTS idx_orders_related_order_id ON public.orders(related_order_id);

-- 5. Comment on columns for clarity
COMMENT ON COLUMN public.orders.order_type IS 'NEW: 신규 구매, EXT: 연장/재구매';
COMMENT ON COLUMN public.orders.related_order_id IS '연장 주문일 경우 원본 주문의 ID (Optional)';
