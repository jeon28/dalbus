-- legacy_tidal_accounts 수정(UPDATE) 전면 실패 수정 (2026-06-12)
--
-- 증상: 관리자 LEGACY-TIDAL 그룹 계정 수정 시 "실패: Failed to update".
-- 원인: legacy_tidal_accounts 테이블에 NEW.updated_at 을 채우는 BEFORE UPDATE
--       트리거가 걸려 있으나(레포 외부, SQL Editor에서 생성된 것으로 추정)
--       테이블에 updated_at 컬럼이 없어 모든 UPDATE가
--       42703: record "new" has no field "updated_at" 으로 실패.
-- 조치: 누락된 updated_at 컬럼을 추가한다. (legacy_tidal_assignments 등
--       다른 테이블은 컬럼이 있거나 트리거가 없어 정상 — 점검 완료)

ALTER TABLE public.legacy_tidal_accounts
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 확인용: 아래 UPDATE가 에러 없이 1행을 반환하면 성공
-- UPDATE public.legacy_tidal_accounts SET memo = memo WHERE login_id = 'HA10' RETURNING id, updated_at;
