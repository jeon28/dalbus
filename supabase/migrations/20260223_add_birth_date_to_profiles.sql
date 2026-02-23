-- profiles 테이블에 생년월일(birth_date) 필드 추가
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS birth_date TEXT;

-- 기존 auth.users의 metadata에 저장된 생년월일이 있다면 profiles로 복사 (선택 사항)
-- Supabase에서 metadata는 raw_user_meta_data 필드에 JSON으로 저장됨
UPDATE public.profiles p
SET birth_date = (u.raw_user_meta_data->>'birthdate')
FROM auth.users u
WHERE p.id = u.id 
  AND p.birth_date IS NULL 
  AND u.raw_user_meta_data->>'birthdate' IS NOT NULL;

COMMENT ON COLUMN public.profiles.birth_date IS '사용자 생년월일 (YYYY.MM.DD 형식)';
