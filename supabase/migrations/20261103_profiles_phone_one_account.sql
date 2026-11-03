-- [Dalbus] 전화번호 1인 1계정
-- Supabase SQL Editor 에서 실행. 여러 번 실행해도 안전하다(idempotent).
--
-- 1) 기존 전화번호 형식 통일 (01012345678 → 010-1234-5678)
-- 2) 가입 트리거: 이미 다른 회원이 쓰는 번호는 새 프로필에 넣지 않음 (가입 자체는 실패시키지 않음)
-- 3) 숫자만 남긴 전화번호에 유니크 인덱스 — 기존 중복이 남아 있으면 만들지 않고 NOTICE 로 알려준다
--    → 중복 정리 후 이 파일을 다시 실행하면 인덱스가 생성된다.

-- 1. 형식 통일 -----------------------------------------------------------
UPDATE public.profiles
SET phone = regexp_replace(regexp_replace(phone, '\D', '', 'g'), '^(\d{3})(\d{4})(\d{4})$', '\1-\2-\3')
WHERE phone IS NOT NULL
  AND length(regexp_replace(phone, '\D', '', 'g')) = 11
  AND phone <> regexp_replace(regexp_replace(phone, '\D', '', 'g'), '^(\d{3})(\d{4})(\d{4})$', '\1-\2-\3');

UPDATE public.profiles
SET phone = regexp_replace(regexp_replace(phone, '\D', '', 'g'), '^(\d{3})(\d{3})(\d{4})$', '\1-\2-\3')
WHERE phone IS NOT NULL
  AND length(regexp_replace(phone, '\D', '', 'g')) = 10
  AND phone <> regexp_replace(regexp_replace(phone, '\D', '', 'g'), '^(\d{3})(\d{3})(\d{4})$', '\1-\2-\3');

-- 2. 가입 트리거 ---------------------------------------------------------
--    20260602_handle_new_user_complete.sql 기준 + 전화번호 정규화·중복 시 비움
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    provider    TEXT;
    meta_phone  TEXT;
    meta_birth  TEXT;
    guest_phone TEXT;
    final_phone TEXT;
    digits      TEXT;
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

    final_phone := CASE WHEN meta_phone <> '' THEN meta_phone ELSE COALESCE(guest_phone, '') END;
    digits := regexp_replace(final_phone, '\D', '', 'g');

    -- 형식 통일
    IF length(digits) = 11 THEN
        final_phone := regexp_replace(digits, '^(\d{3})(\d{4})(\d{4})$', '\1-\2-\3');
    ELSIF length(digits) = 10 THEN
        final_phone := regexp_replace(digits, '^(\d{3})(\d{3})(\d{4})$', '\1-\2-\3');
    END IF;

    -- 1인 1계정: 다른 회원이 이미 쓰는 번호면 비워 둔다 (주문/추가정보 단계에서 기존 계정 안내)
    IF digits <> '' AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') = digits
    ) THEN
        final_phone := '';
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
        final_phone,
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
'신규 가입 시 프로필 생성 및 게스트 주문 자동 연동.
 - phone: 가입 메타데이터 우선, 없으면 이전 게스트 주문의 buyer_phone. 010-0000-0000 형식으로 저장
 - 1인 1계정: 다른 회원이 쓰는 번호면 비워 둠 (20261103)';

-- 3. 유니크 인덱스 -------------------------------------------------------
DO $$
DECLARE
    dup_count INT;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'profiles_phone_digits_unique') THEN
        RAISE NOTICE '이미 profiles_phone_digits_unique 인덱스가 있습니다.';
        RETURN;
    END IF;

    SELECT count(*) INTO dup_count FROM (
        SELECT regexp_replace(phone, '\D', '', 'g')
        FROM public.profiles
        WHERE COALESCE(phone, '') <> ''
        GROUP BY 1
        HAVING count(*) > 1
    ) d;

    IF dup_count > 0 THEN
        RAISE NOTICE '전화번호 중복 % 건이 남아 있어 유니크 인덱스를 만들지 않았습니다. 중복 정리 후 이 파일을 다시 실행하세요.', dup_count;
    ELSE
        CREATE UNIQUE INDEX profiles_phone_digits_unique
            ON public.profiles ((regexp_replace(phone, '\D', '', 'g')))
            WHERE COALESCE(phone, '') <> '';
        RAISE NOTICE 'profiles_phone_digits_unique 인덱스를 만들었습니다.';
    END IF;
END $$;

-- 참고: 중복 목록 확인
-- select regexp_replace(phone, '\D', '', 'g') as phone_digits, count(*),
--        string_agg(email || ' (' || coalesce(signup_method, 'email') || ', ' || created_at::date || ')', ', ' order by created_at)
-- from profiles where coalesce(phone, '') <> '' group by 1 having count(*) > 1;
