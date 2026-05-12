-- Fix handle_new_user trigger to set signup_method from auth provider
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    provider TEXT;
BEGIN
    provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

    INSERT INTO public.profiles (id, email, name, role, signup_method)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1)),
        'user',
        provider
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
