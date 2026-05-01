-- [Dalbus v2.0] Test Data Generation Script
-- Run this in Supabase SQL Editor

-- 1. Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create Test Users (auth.users) & Profiles
-- Note: We generally rely on triggers to create profiles, but here we insert safely.
-- Password '1q2w3e4r5t' hashed.

DO $$
DECLARE
    user1_id UUID := gen_random_uuid();
    user2_id UUID := gen_random_uuid();
    user3_id UUID := gen_random_uuid();
    enc_pw TEXT := crypt('1q2w3e4r5t', gen_salt('bf'));
    tidal_id UUID;
    plan_id UUID;
BEGIN
    -- Get Product IDs
    SELECT id INTO tidal_id FROM products WHERE slug = 'tidal-hifi' LIMIT 1;
    SELECT id INTO plan_id FROM product_plans WHERE product_id = tidal_id LIMIT 1;

    -- ==========================================
    -- Create Users (test01, test02, test03)
    -- ==========================================
    
    -- User 1
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (
        user1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test01@naver.com', enc_pw, NOW(), 
        '{"provider":"email","providers":["email"]}', '{"name":"테스트유저1"}', NOW(), NOW()
    );
    INSERT INTO public.profiles (id, email, name, phone, role)
    VALUES (user1_id, 'test01@naver.com', '테스트유저1', '010-1111-1111', 'user')
    ON CONFLICT (id) DO NOTHING; -- Handle trigger conflict if exists

    -- User 2
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (
        user2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test02@naver.com', enc_pw, NOW(), 
        '{"provider":"email","providers":["email"]}', '{"name":"테스트유저2"}', NOW(), NOW()
    );
    INSERT INTO public.profiles (id, email, name, phone, role)
    VALUES (user2_id, 'test02@naver.com', '테스트유저2', '010-2222-2222', 'user')
    ON CONFLICT (id) DO NOTHING;

    -- User 3
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES (
        user3_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test03@naver.com', enc_pw, NOW(), 
        '{"provider":"email","providers":["email"]}', '{"name":"테스트유저3"}', NOW(), NOW()
    );
    INSERT INTO public.profiles (id, email, name, phone, role)
    VALUES (user3_id, 'test03@naver.com', '테스트유저3', '010-3333-3333', 'user')
    ON CONFLICT (id) DO NOTHING;

    -- ==========================================
    -- Create Member Orders (3 orders)
    -- ==========================================
    IF tidal_id IS NOT NULL AND plan_id IS NOT NULL THEN
        -- Order for User 1
        INSERT INTO orders (user_id, product_id, plan_id, amount, payment_status, assignment_status, is_guest, order_number)
        VALUES (user1_id, tidal_id, plan_id, 5900, 'paid'::payment_status, 'waiting'::assignment_status, false, 'ORD-' || floor(random() * 1000000)::text);

        -- Order for User 2
        INSERT INTO orders (user_id, product_id, plan_id, amount, payment_status, assignment_status, is_guest, order_number)
        VALUES (user2_id, tidal_id, plan_id, 14900, 'paid'::payment_status, 'assigned'::assignment_status, false, 'ORD-' || floor(random() * 1000000)::text);

        -- Order for User 3
        INSERT INTO orders (user_id, product_id, plan_id, amount, payment_status, assignment_status, is_guest, order_number)
        VALUES (user3_id, tidal_id, plan_id, 5900, 'pending'::payment_status, 'waiting'::assignment_status, false, 'ORD-' || floor(random() * 1000000)::text);
    END IF;

    -- ==========================================
    -- Create Guest Orders (10 orders)
    -- ==========================================
    IF tidal_id IS NOT NULL AND plan_id IS NOT NULL THEN
        FOR i IN 1..10 LOOP
            INSERT INTO orders (
                user_id, product_id, plan_id, amount, payment_status, assignment_status, is_guest, 
                buyer_name, buyer_email, buyer_phone, depositor_name, order_number, created_at
            )
            VALUES (
                NULL, -- Guest has no user_id
                tidal_id, 
                plan_id, 
                5900, 
                CASE WHEN i % 5 = 0 THEN 'pending'::payment_status ELSE 'paid'::payment_status END, -- Mix statuses
                CASE WHEN i % 3 = 0 THEN 'assigned'::assignment_status ELSE 'waiting'::assignment_status END, 
                true,
                '비회원구매자' || i,
                'guest' || i || '@example.com',
                '010-9999-' || lpad(i::text, 4, '0'),
                '입금자' || i,
                'GST-' || floor(random() * 1000000)::text,
                NOW() - (i || ' days')::INTERVAL -- Spread over last 10 days
            );
        END LOOP;
    END IF;

END $$;
