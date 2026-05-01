-- Create notice_categories table
CREATE TABLE IF NOT EXISTS notice_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert current categories into the new table
INSERT INTO notice_categories (name, sort_order) VALUES 
('서비스', 1),
('업데이트', 2),
('이벤트', 3),
('점검안내', 4)
ON CONFLICT (name) DO NOTHING;

-- Modify notices table to use text for category instead of enum
-- Step 1: Add a temporary column
ALTER TABLE notices ADD COLUMN category_new TEXT;

-- Step 2: Map old enum values to names (matching notice_category enum)
-- service, update, event, maintenance
UPDATE notices SET category_new = '서비스' WHERE category::text = 'service';
UPDATE notices SET category_new = '업데이트' WHERE category::text = 'update';
UPDATE notices SET category_new = '이벤트' WHERE category::text = 'event';
UPDATE notices SET category_new = '점검안내' WHERE category::text = 'maintenance';

-- Step 3: Set default for new column
ALTER TABLE notices ALTER COLUMN category_new SET DEFAULT '서비스';

-- Step 4: Drop old column and rename new one
ALTER TABLE notices DROP COLUMN category;
ALTER TABLE notices RENAME COLUMN category_new TO category;
