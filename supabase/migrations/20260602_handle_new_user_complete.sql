-- Final complete handle_new_user trigger
-- Combines: signup_method, phone/birth_date from signup metadata,
--           guest order phone fallback, guest order auto-linking

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    provider    TEXT;
    meta_phone  TEXT;
    meta_birth  TEXT;
    guest_phone TEXT;
BEGIN
    provider   := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
    meta_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
    meta_birth := COALESCE(NEW.raw_user_meta_data->>'birthdate', '');

    -- 1. 게스트 주문에서 전화번호 가져오기 (가입 폼에 입력이 없을 때 대비)
    IF meta_phone = '' THEN
        SELECT buyer_phone
        INTO guest_phone
        FROM public.orders
        WHERE buyer_email = NEW.email
          AND buyer_phone IS NOT NULL
          AND (is_guest = true OR user_id IS NULL)
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    -- 2. 프로필 생성
    INSERT INTO public.profiles (id, email, name, phone, birth_date, role, signup_method)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            split_part(COALESCE(NEW.email, ''), '@', 1)
        ),
        CASE WHEN meta_phone != '' THEN meta_phone ELSE COALESCE(guest_phone, '') END,
        meta_birth,
        'user',
        provider
    );

    -- 3. 기존 게스트 주문 → 새 회원 계정으로 자동 연결
    UPDATE public.orders
    SET
        user_id  = NEW.id,
        is_guest = false
    WHERE buyer_email = NEW.email
      AND (is_guest = true OR user_id IS NULL);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION handle_new_user() IS
'신규 가입 시 프로필 생성 및 게스트 주문 자동 연동 (최종본).
 - signup_method: auth provider에서 읽음
 - phone: 가입 메타데이터 우선, 없으면 이전 게스트 주문의 buyer_phone 사용
 - birth_date: 가입 폼 메타데이터에서만 저장
 - 게스트 주문 자동 연결: buyer_email 기준';
