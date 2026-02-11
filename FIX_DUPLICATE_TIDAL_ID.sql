-- ============================================
-- Dalbus: 중복 Tidal ID 정리 스크립트
-- ============================================
-- 문제: guest7@hifitidal.com 같은 tidal_id가 중복됨
-- 해결: 중복 제거 후 UNIQUE constraint 추가
-- ============================================

-- ============================================
-- STEP 1: 중복 데이터 확인
-- ============================================

-- 1-1. 모든 중복 tidal_id 조회
SELECT
    tidal_id,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(id ORDER BY assigned_at ASC) as record_ids,
    ARRAY_AGG(assigned_at ORDER BY assigned_at ASC) as assigned_dates
FROM order_accounts
WHERE tidal_id IS NOT NULL AND tidal_id != ''
GROUP BY tidal_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 1-2. guest7@hifitidal.com 상세 조회
SELECT
    id,
    account_id,
    slot_number,
    tidal_id,
    slot_password,
    order_id,
    assigned_at,
    created_at
FROM order_accounts
WHERE tidal_id = 'guest7@hifitidal.com'
ORDER BY assigned_at ASC;

-- ============================================
-- STEP 2: 중복 제거 전략 선택
-- ============================================

-- 옵션 A: 가장 오래된 것만 남기고 나머지 삭제 (권장)
-- 옵션 B: 가장 최근 것만 남기고 나머지 삭제
-- 옵션 C: 수동으로 선택하여 삭제

-- ============================================
-- STEP 3-A: 자동 정리 (가장 오래된 것 유지)
-- ============================================

-- ⚠️ WARNING: 이 쿼리는 실제로 데이터를 삭제합니다!
-- 반드시 STEP 1 결과를 확인한 후 실행하세요.

-- 백업 테이블 생성 (선택사항)
CREATE TABLE IF NOT EXISTS order_accounts_backup_20260211 AS
SELECT * FROM order_accounts
WHERE tidal_id IN (
    SELECT tidal_id FROM order_accounts
    WHERE tidal_id IS NOT NULL AND tidal_id != ''
    GROUP BY tidal_id HAVING COUNT(*) > 1
);

-- 중복 데이터 삭제 (가장 오래된 1개만 유지)
DELETE FROM order_accounts
WHERE id IN (
    SELECT id
    FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (PARTITION BY tidal_id ORDER BY assigned_at ASC NULLS LAST) as rn
        FROM order_accounts
        WHERE tidal_id IS NOT NULL AND tidal_id != ''
    ) t
    WHERE rn > 1
);

-- 삭제 결과 확인
SELECT
    'Deleted duplicates' as action,
    COUNT(*) as remaining_count
FROM order_accounts
WHERE tidal_id = 'guest7@hifitidal.com';

-- ============================================
-- STEP 3-B: 수동 정리 (특정 레코드만 삭제)
-- ============================================

-- guest7@hifitidal.com의 중복 중에서 특정 ID만 삭제
-- 아래 ID는 예시이므로 STEP 1-2 결과를 보고 실제 ID로 교체하세요

-- DELETE FROM order_accounts
-- WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';  -- 삭제할 레코드 ID

-- ============================================
-- STEP 4: UNIQUE Constraint 추가
-- ============================================

-- 중복 제거 후 다시 실행
ALTER TABLE public.order_accounts
ADD CONSTRAINT order_accounts_tidal_id_key UNIQUE (tidal_id);

ALTER TABLE public.order_accounts
ADD CONSTRAINT order_accounts_account_slot_key UNIQUE (account_id, slot_number);

-- ============================================
-- STEP 5: 검증
-- ============================================

-- 5-1. Constraint 생성 확인
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'order_accounts'::regclass
AND conname IN ('order_accounts_tidal_id_key', 'order_accounts_account_slot_key');

-- 5-2. 중복 재확인 (결과 0이어야 함)
SELECT tidal_id, COUNT(*)
FROM order_accounts
WHERE tidal_id IS NOT NULL AND tidal_id != ''
GROUP BY tidal_id
HAVING COUNT(*) > 1;

-- ============================================
-- ROLLBACK (문제 발생 시)
-- ============================================

-- Constraint 제거
-- ALTER TABLE order_accounts DROP CONSTRAINT IF EXISTS order_accounts_tidal_id_key;
-- ALTER TABLE order_accounts DROP CONSTRAINT IF EXISTS order_accounts_account_slot_key;

-- 백업에서 복원 (백업을 만든 경우에만)
-- INSERT INTO order_accounts
-- SELECT * FROM order_accounts_backup_20260211
-- WHERE id NOT IN (SELECT id FROM order_accounts);

-- 백업 테이블 삭제 (복원 완료 후)
-- DROP TABLE IF EXISTS order_accounts_backup_20260211;

-- ============================================
-- 참고사항
-- ============================================
-- 1. 중복 데이터가 많으면 트랜잭션으로 처리 권장:
--    BEGIN;
--    DELETE FROM ...;
--    -- 결과 확인 후
--    COMMIT; -- 또는 ROLLBACK;
--
-- 2. used_slots 동기화 필요 시:
--    UPDATE accounts a
--    SET used_slots = (
--        SELECT COUNT(*) FROM order_accounts oa
--        WHERE oa.account_id = a.id
--    );
