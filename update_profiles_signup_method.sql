-- [DAL-51] Add Signup Path to Profiles
-- Run this in Supabase SQL Editor

-- 1. Add signup_method column
ALTER TABLE public.profiles ADD COLUMN signup_method TEXT;

-- 2. Update handle_new_user trigger function to auto-populate signup_method
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role, signup_method)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        'user',
        COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill existing profiles' signup methods from auth.users
UPDATE public.profiles p
SET signup_method = COALESCE(u.raw_app_meta_data->>'provider', 'email')
FROM auth.users u
WHERE p.id = u.id AND p.signup_method IS NULL;
