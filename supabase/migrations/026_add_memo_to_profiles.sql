-- Add memo column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS memo TEXT;

-- Comment for documentation
COMMENT ON COLUMN profiles.memo IS 'Admin-only memo for the user profile';
