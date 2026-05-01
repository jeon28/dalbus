-- Add admin_email and admin_phone columns to site_settings table
ALTER TABLE site_settings 
ADD COLUMN IF NOT EXISTS admin_email TEXT,
ADD COLUMN IF NOT EXISTS admin_phone TEXT;

-- Update existing row with nulls or empty strings if needed (optional since columns allow nulls)
UPDATE site_settings SET admin_email = '', admin_phone = '' WHERE id = 'main' AND (admin_email IS NULL OR admin_phone IS NULL);
