-- profiles 테이블에 생년월일(birth_date) 필드 추가
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS birth_date TEXT;

-- 가입 시 프로필을 자동 생성하는 트리거 함수 업데이트 (전화번호와 생년월일 추가)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, phone, birth_date, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'birthdate',
        'user'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 auth.users의 metadata에 저장된 생년월일이 있다면 profiles로 복사
UPDATE public.profiles p
SET 
    birth_date = (u.raw_user_meta_data->>'birthdate'),
    phone = COALESCE(p.phone, u.raw_user_meta_data->>'phone')
FROM auth.users u
WHERE p.id = u.id 
  AND (p.birth_date IS NULL OR p.phone IS NULL)
  AND u.raw_user_meta_data IS NOT NULL;

COMMENT ON COLUMN public.profiles.birth_date IS '사용자 생년월일 (YYYY.MM.DD 형식)';
