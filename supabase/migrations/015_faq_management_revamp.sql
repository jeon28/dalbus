-- Create faq_categories table
CREATE TABLE IF NOT EXISTS faq_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert current categories into the new table
INSERT INTO faq_categories (name, sort_order) VALUES 
('일반', 1),
('결제/요금', 2),
('계정/이용', 3),
('환불/해지', 4)
ON CONFLICT (name) DO NOTHING;

-- Modify faqs table to use text for category instead of enum
-- Step 1: Add a temporary column
ALTER TABLE faqs ADD COLUMN category_new TEXT;

-- Step 2: Map old enum values to names (using categoryMap logic)
UPDATE faqs SET category_new = '일반' WHERE category::text = 'general';
UPDATE faqs SET category_new = '결제/요금' WHERE category::text = 'payment';
UPDATE faqs SET category_new = '계정/이용' WHERE category::text = 'account';
UPDATE faqs SET category_new = '환불/해지' WHERE category::text = 'refund';

-- Step 3: Set default for new column
ALTER TABLE faqs ALTER COLUMN category_new SET DEFAULT '일반';

-- Step 4: Drop old column and rename new one
ALTER TABLE faqs DROP COLUMN category;
ALTER TABLE faqs RENAME COLUMN category_new TO category;

-- Optionally, you could link by ID, but using TEXT category names is often simpler 
-- for mapping unless there's a reason to use UUIDs. Given the UI, TEXT is fine.
