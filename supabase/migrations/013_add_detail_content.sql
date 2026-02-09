-- Add detail_content column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS detail_content TEXT;
