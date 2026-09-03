-- ============================================================
-- QOBUZ 관리 모듈 테이블 생성
--
-- 구조: qobuz_accounts (대표계정 = 그룹) 1 : N qobuz_assignments (하부계정 = 슬롯)
--
-- legacy_tidal 과의 차이:
--   - 대표계정은 슬롯을 차지하지 않는다. 그룹 레벨 속성(master_email/master_end_date)이며
--     하부계정이 되지 않는다. 따라서 'master'/'user' 를 구분하는 type 컬럼이 없다.
--   - 슬롯 정원은 5 (전부 하부계정).
--   - screen_name 컬럼이 추가된다 (Qobuz 화면 표시명).
--
-- 주의: updated_at 컬럼을 처음부터 포함한다.
--   legacy_tidal_accounts 는 updated_at 트리거만 있고 컬럼이 없어 모든 UPDATE 가
--   42703 으로 실패했고 20260612 마이그레이션으로 사후 수습했다. 같은 사고를 막는다.
--
-- Supabase SQL Editor 에서 실행.
-- ============================================================

-- ------------------------------------------------------------
-- 1. qobuz_accounts : 대표계정(그룹)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qobuz_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- 그룹 ID (QG01 형식). 항상 대문자로 저장한다.
    login_id        TEXT NOT NULL,
    login_pw        TEXT,
    -- 시트 B열: 대표계정 이메일 (소문자 정규화)
    master_email    TEXT,
    -- 시트 C열: 대표계정 종료일
    master_end_date DATE,
    status          TEXT NOT NULL DEFAULT 'available',
    -- 대표계정 1개당 하부계정 5개
    max_slots       INTEGER NOT NULL DEFAULT 5,
    used_slots      INTEGER NOT NULL DEFAULT 0,
    memo            TEXT,
    payment_email   TEXT,
    payment_day     INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT qobuz_accounts_status_check
        CHECK (status IN ('available', 'assigned', 'disabled', 'deleted')),
    CONSTRAINT qobuz_accounts_payment_day_check
        CHECK (payment_day BETWEEN 1 AND 31),
    CONSTRAINT qobuz_accounts_max_slots_check
        CHECK (max_slots > 0)
);

-- 그룹 ID 는 유일하다. 임포트 스크립트의 재실행 방지도 이 제약에 의존한다.
CREATE UNIQUE INDEX IF NOT EXISTS qobuz_accounts_login_id_idx
    ON public.qobuz_accounts (login_id);

-- ------------------------------------------------------------
-- 2. qobuz_assignments : 하부계정(슬롯)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qobuz_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID NOT NULL REFERENCES public.qobuz_accounts(id) ON DELETE CASCADE,
    -- 0-based (0~4). 화면 표기는 login_id-(slot_number+1) → QG01-1 ~ QG01-5
    -- 슬롯 번호 고정 정책: 중간 슬롯을 삭제/비활성해도 뒤 번호를 당겨오지 않는다.
    slot_number     INTEGER NOT NULL DEFAULT 0,
    -- 시트 D열: ID (소문자 정규화)
    qobuz_id        TEXT,
    qobuz_password  TEXT,
    -- 시트 E열: SCREEN NAME
    screen_name     TEXT,
    -- 시트 H열 / F열 / G열
    buyer_name      TEXT,
    buyer_phone     TEXT,
    buyer_email     TEXT,
    order_number    TEXT,
    -- 시트 I열 / J열 / K열
    start_date      DATE,
    end_date        DATE,
    period_months   INTEGER,
    amount          INTEGER,
    memo            TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 부분 유니크 인덱스: 활성 행만 대상으로 한다.
-- 비활성/삭제 행은 이력으로 남아야 하므로 제약에서 제외한다.
CREATE UNIQUE INDEX IF NOT EXISTS qobuz_assignments_qobuz_id_active_idx
    ON public.qobuz_assignments (qobuz_id)
    WHERE is_active = TRUE AND qobuz_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS qobuz_assignments_account_slot_active_idx
    ON public.qobuz_assignments (account_id, slot_number)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS qobuz_assignments_account_id_idx
    ON public.qobuz_assignments (account_id);

CREATE INDEX IF NOT EXISTS qobuz_assignments_end_date_idx
    ON public.qobuz_assignments (end_date)
    WHERE is_active = TRUE AND is_deleted = FALSE;

-- ------------------------------------------------------------
-- 3. updated_at 자동 갱신 트리거
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_qobuz_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS qobuz_accounts_set_updated_at ON public.qobuz_accounts;
CREATE TRIGGER qobuz_accounts_set_updated_at
    BEFORE UPDATE ON public.qobuz_accounts
    FOR EACH ROW EXECUTE FUNCTION public.set_qobuz_updated_at();

DROP TRIGGER IF EXISTS qobuz_assignments_set_updated_at ON public.qobuz_assignments;
CREATE TRIGGER qobuz_assignments_set_updated_at
    BEFORE UPDATE ON public.qobuz_assignments
    FOR EACH ROW EXECUTE FUNCTION public.set_qobuz_updated_at();

-- ------------------------------------------------------------
-- 4. RLS
--    20260610_p0_restore_rls.sql 의 민감 테이블 패턴을 따른다.
--    관리자만 직접 접근 허용. 서버 API 는 service_role 로 우회하므로 영향 없음.
--    (20260329_create_legacy_tidal_account.sql 의 USING(true) WITH CHECK(true) 는
--     사실상 전 롤 허용이므로 따라하지 않는다.)
-- ------------------------------------------------------------
ALTER TABLE public.qobuz_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qobuz_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qobuz_accounts_admin_all" ON public.qobuz_accounts;
CREATE POLICY "qobuz_accounts_admin_all"
    ON public.qobuz_accounts FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "qobuz_assignments_admin_all" ON public.qobuz_assignments;
CREATE POLICY "qobuz_assignments_admin_all"
    ON public.qobuz_assignments FOR ALL USING (public.is_admin());

-- ------------------------------------------------------------
-- 5. 종료 메일 템플릿 시딩
--    QobuzContent 는 key 가 'QOBUZ' 로 시작하는 템플릿만 노출한다.
-- ------------------------------------------------------------
INSERT INTO public.email_templates (key, name, subject, content, placeholders)
VALUES (
    'QOBUZ_EXPIRY_NOTICE',
    'QOBUZ 구독 종료 안내',
    '[달버스] QOBUZ 구독 종료 안내 - {buyer_name}님',
    '<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
  <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">QOBUZ 구독 종료 안내</h2>
  <p><strong>{buyer_name}</strong>님, 안녕하세요.</p>
  <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 5px 0;"><strong>계정:</strong> {qobuz_id}</p>
    <p style="margin: 5px 0;"><strong>종료일:</strong> {end_date}</p>
  </div>
  <p style="white-space: pre-line;">{message}</p>
  <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
  <p style="font-size: 0.8rem; color: #666;">본 메일은 발신전용입니다.</p>
</div>',
    '["buyer_name", "qobuz_id", "end_date", "message"]'::jsonb
)
ON CONFLICT (key) DO NOTHING;
