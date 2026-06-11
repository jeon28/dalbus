-- ============================================================
-- [Dalbus P0 보안 후속] site_settings 완전 잠금
-- ============================================================
-- 배경:
--   20260610_p0_restore_rls.sql 은 대표적인 이름의 과거 정책만 DROP 했는데,
--   운영 DB 의 site_settings 에 다른 이름의 공개(SELECT) 정책이 남아 있어
--   anon 키로 admin_login_pw 등 설정값이 그대로 조회되는 문제가 확인됨.
--   (정책은 OR 로 합쳐지므로 공개 정책이 하나라도 남으면 잠금이 무효)
--
-- 조치:
--   이름과 무관하게 site_settings 의 "모든" 정책을 동적으로 제거한 뒤
--   관리자 전용 정책 하나만 재생성한다.
--   앱의 site_settings 접근은 전부 서버(service_role, RLS 우회) 경유이므로
--   기능 영향 없음. (api/public/settings, lib/brand, lib/auth, lib/email 등)
-- ============================================================

BEGIN;

DO $$
DECLARE
    pol RECORD;
BEGIN
    -- 이름과 무관하게 기존 정책 전부 제거
    FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'site_settings'
    LOOP
        EXECUTE format('DROP POLICY %I ON public.site_settings;', pol.policyname);
    END LOOP;
END $$;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- 관리자(Supabase 세션 + role=admin)만 직접 접근 허용.
-- 서버 API 는 service_role 로 RLS 를 우회하므로 이 정책의 영향을 받지 않는다.
CREATE POLICY "site_settings_admin_all" ON public.site_settings
    FOR ALL USING (public.is_admin());

COMMIT;

-- 적용 후 검증 (anon 키로):
--   GET /rest/v1/site_settings?select=*  →  [] (빈 배열) 이어야 함
