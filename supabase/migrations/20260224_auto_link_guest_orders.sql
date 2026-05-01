-- [Dalbus v2.1] Supabase Migration Script - Auto-link Guest Orders on Signup

-- 가입 시 프로필을 자동 생성하고, 기존 비회원 주문을 자동으로 연결하는 트리거 함수 업데이트
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. 프로필 생성
    INSERT INTO public.profiles (id, email, name, phone, birth_date, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'birthdate',
        'user'
    );

    -- 2. 기존 비회원 주문 내역이 있다면 새 계정으로 연결 및 회원 주문으로 전환
    UPDATE public.orders
    SET 
        user_id = NEW.id,
        is_guest = false
    WHERE buyer_email = NEW.email
      AND (is_guest = true OR user_id IS NULL);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION handle_new_user() IS '신규 가입 시 프로필 생성 및 기존 비회원 주문 자동 연동 트리거';
