-- Fix handle_new_user trigger to also save phone and birth_date from signup metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    provider TEXT;
BEGIN
    provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

    INSERT INTO public.profiles (id, email, name, phone, birth_date, role, signup_method)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        COALESCE(NEW.raw_user_meta_data->>'birthdate', ''),
        'user',
        provider
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
