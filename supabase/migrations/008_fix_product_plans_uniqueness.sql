-- [DAL-19] Allow duplicate months for inactive product plans
-- This migration replaces the strict unique constraint with a partial unique index
-- that only enforces uniqueness for active plans.

-- 1. Drop existing unique constraint if it exists
-- The constraint name is 'product_plans_product_id_duration_months_key' based on schema analysis
ALTER TABLE public.product_plans 
DROP CONSTRAINT IF EXISTS product_plans_product_id_duration_months_key;

-- 2. Create a partial unique index for active plans only
-- This allows multiple inactive plans with the same duration, 
-- but only one active plan per duration for a product.
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_plans_active_unique 
ON public.product_plans (product_id, duration_months) 
WHERE (is_active = true);
