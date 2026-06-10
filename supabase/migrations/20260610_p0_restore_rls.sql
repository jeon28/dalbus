-- ============================================================
-- [Dalbus P0 보안] RLS 복원 및 민감 테이블 잠금
-- ============================================================
-- 목적:
--   1. orders / profiles 에 남아있는 과도한 USING(true) 정책 제거 → 본인/관리자만 접근
--   2. 자격증명·설정 테이블(site_settings, bank_accounts, tidal/legacy 계정·배정 등)을
--      service_role 전용으로 잠가 anon/authenticated 직접 접근 차단
--   3. 정책이 비어있던 order_accounts / notification_logs 에 정책 부여
--
-- 전제:
--   - 모든 관리자/민감 데이터 접근은 서버 API(service_role, supabaseAdmin)를 경유한다.
--     (service_role 은 RLS 를 우회하므로 아래 정책의 영향을 받지 않는다.)
--   - 클라이언트(anon/authenticated)의 직접 조회는 "본인 데이터"로 제한된다.
--
-- ⚠️ 적용 전 반드시:
--   1) 운영 DB 백업/스냅샷
--   2) 스테이징에서 먼저 실행 후 회원/주문/마이페이지 흐름 점검
--   3) 현재 정책 확인:  SELECT * FROM pg_policies WHERE schemaname='public';
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. is_admin() 헬퍼 보장 (이미 있으면 교체)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ------------------------------------------------------------
-- 1. ORDERS : 전체공개(USING true) 정책 제거 → 본인/관리자만
-- ------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 과거에 추가된 과도한 정책들 제거 (이름이 다를 수 있어 가능한 변형 모두 시도)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.orders;          -- 006_allow_order_select
DROP POLICY IF EXISTS "Authenticated users can view all orders" ON public.orders;    -- supabase_RLS_fix
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins manage all orders" ON public.orders;

-- 본인 주문만 조회 (로그인 사용자). 게스트 주문 조회/생성은 서버 API(service_role) 경유.
CREATE POLICY "orders_select_own" ON public.orders
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "orders_insert_own" ON public.orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orders_admin_all" ON public.orders
    FOR ALL USING (public.is_admin());

-- ------------------------------------------------------------
-- 2. PROFILES : 전체조회(USING true) 제거 → 본인/관리자만
-- ------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles; -- supabase_RLS_fix
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles
    FOR ALL USING (public.is_admin());

-- ------------------------------------------------------------
-- 3. ORDER_ACCOUNTS : RLS on 인데 정책이 없던 테이블 → 관리자만(서버는 service_role 우회)
-- ------------------------------------------------------------
ALTER TABLE public.order_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_accounts_admin_all" ON public.order_accounts;
CREATE POLICY "order_accounts_admin_all" ON public.order_accounts
    FOR ALL USING (public.is_admin());

-- ------------------------------------------------------------
-- 4. NOTIFICATION_LOGS : 정책 없음 → 관리자만
-- ------------------------------------------------------------
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notification_logs_admin_all" ON public.notification_logs;
CREATE POLICY "notification_logs_admin_all" ON public.notification_logs
    FOR ALL USING (public.is_admin());

-- ------------------------------------------------------------
-- 5. 자격증명/설정 테이블 : RLS 켜고 정책 없음 = service_role 만 접근
--    (anon/authenticated 의 PostgREST 직접 접근을 전면 차단. 서버 API 는 service_role 로 우회)
--    존재하지 않는 테이블이 있을 수 있어 DO 블록으로 안전 처리.
-- ------------------------------------------------------------
DO $$
DECLARE
    t TEXT;
    sensitive_tables TEXT[] := ARRAY[
        'site_settings',
        'bank_accounts',
        'accounts',
        'tidal_accounts',
        'tidal_assignments',
        'legacy_tidal_accounts',
        'legacy_tidal_assignments',
        'legacy_tidal_account',
        'email_templates',
        'mail_history',
        'verification_codes'
    ];
BEGIN
    FOREACH t IN ARRAY sensitive_tables LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) THEN
            -- RLS 활성화 (정책이 하나도 없으면 anon/authenticated 는 전면 차단됨)
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
            -- 과거의 과도한 정책 정리 (대표적인 이름들)
            EXECUTE format('DROP POLICY IF EXISTS "Service role full access to %s" ON public.%I;', t, t);
            EXECUTE format('DROP POLICY IF EXISTS "Enable read access for all users" ON public.%I;', t);
            EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can view all shared accounts" ON public.%I;', t);
            -- 관리자만 직접 접근 허용 (서버 API 는 service_role 로 우회하므로 영향 없음)
            EXECUTE format('DROP POLICY IF EXISTS "%s_admin_all" ON public.%I;', t, t);
            EXECUTE format('CREATE POLICY "%s_admin_all" ON public.%I FOR ALL USING (public.is_admin());', t, t);
        END IF;
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- 6. QNA : 게스트 글 작성은 허용하되, 비밀글 본문 보호는 서버 API 에서 마스킹.
--    (직접 SELECT 노출을 줄이려면 아래처럼 비밀글은 본인/관리자만 보이게 할 수 있으나,
--     게스트 글은 user_id 가 없어 RLS 만으로 소유자 판별이 어렵다 → 서버 마스킹을 신뢰.)
--    여기서는 INSERT 무제한(WITH CHECK true)만 유지하고 SELECT 는 서버 경유 권장.
-- ------------------------------------------------------------
-- (정책 변경 없음 — 애플리케이션 레벨 마스킹으로 처리. 필요 시 별도 마이그레이션에서 강화)

COMMIT;

-- ============================================================
-- 적용 후 검증 쿼리 (psql / SQL Editor 에서 실행)
-- ============================================================
-- 1) 정책 목록 확인:
--    SELECT schemaname, tablename, policyname, cmd, qual
--    FROM pg_policies WHERE schemaname='public' ORDER BY tablename;
--
-- 2) anon 으로 orders 전체조회가 막히는지 (anon key 로):
--    select * from orders;   -- → 0 rows (본인 것만, 비로그인은 0)
--
-- 3) 회원 로그인 후 마이페이지/주문이 정상인지 (서버 API 경유 → 정상)
-- ============================================================
