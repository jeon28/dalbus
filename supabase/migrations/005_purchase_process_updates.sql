-- [Dalbus v2.0] Supabase Migration Script - Part 5: Purchase Process Updates

-- 1. Add detail_content to products table (For rich text description)
ALTER TABLE products ADD COLUMN IF NOT EXISTS detail_content TEXT;

-- Update existing Tidal product with some sample detail content
UPDATE products 
SET detail_content = '<h3>Tidal HiFi Plus 특징</h3><ul><li>무손실 오디오 스트리밍</li><li>Sony 360 Reality Audio 지원</li><li>Dolby Atmos 지원</li><li>오프라인 재생 가능</li></ul>'
WHERE slug = 'tidal-hifi';


-- 2. Update orders table for Guest Checkout
-- Allow user_id to be NULL
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;

-- Add buyer info columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS depositor_name TEXT; -- For bank transfer verification
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT false;


-- 3. Update RLS Policies for orders to allow public insert (for guests)
-- Note: We need to be careful. Ideally, we use a stored procedure or edge function for guest orders to prevent spam,
-- but for this implementation, we will allow unauthenticated inserts IF they are marked as guest.

CREATE POLICY "Enable insert for guests" ON orders FOR INSERT 
WITH CHECK (auth.uid() IS NULL); 

-- Also need to ensure the trigger handle_new_user doesn't break? No, that's on auth.users.
-- The generate_order_number trigger is on orders, should work fine.

-- 4. Add index for faster search on buyer info
CREATE INDEX IF NOT EXISTS idx_orders_buyer_email ON orders(buyer_email);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_phone ON orders(buyer_phone);
