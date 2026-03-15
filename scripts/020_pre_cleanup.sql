-- ============================================================
-- Migration 020 사전 정리 스크립트
-- 실행 순서: 이 파일 먼저 실행 → 020_add_unique_tidal_id.sql 실행
-- Supabase 대시보드 > SQL Editor에서 실행
-- ============================================================


-- ============================================================
-- STEP 1. [조회] 중복 tidal_id 확인
-- ============================================================
SELECT 
    tidal_id, 
    COUNT(*) AS duplicate_count,
    array_agg(id ORDER BY assigned_at ASC) AS ids,
    array_agg(account_id ORDER BY assigned_at ASC) AS account_ids,
    array_agg(slot_number ORDER BY assigned_at ASC) AS slot_numbers
FROM order_accounts
WHERE tidal_id IS NOT NULL AND tidal_id != ''
GROUP BY tidal_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;


-- ============================================================
-- STEP 2. [조회] 중복 (account_id, slot_number) 확인
-- ============================================================
SELECT 
    account_id,
    slot_number,
    COUNT(*) AS duplicate_count,
    array_agg(id ORDER BY assigned_at ASC) AS ids,
    array_agg(tidal_id ORDER BY assigned_at ASC) AS tidal_ids
FROM order_accounts
GROUP BY account_id, slot_number
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;


-- ============================================================
-- STEP 3. [삭제] 중복 tidal_id 제거 (가장 오래된 것만 남기고 삭제)
-- 주의: 삭제 전 위 STEP 1 결과를 반드시 확인하세요!
-- ============================================================
DELETE FROM order_accounts
WHERE id IN (
    SELECT id FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY tidal_id 
                ORDER BY assigned_at ASC  -- 가장 오래된 데이터를 남김
            ) AS rn
        FROM order_accounts
        WHERE tidal_id IS NOT NULL AND tidal_id != ''
    ) t
    WHERE rn > 1
);


-- ============================================================
-- STEP 4. [삭제] 중복 (account_id, slot_number) 제거 (가장 오래된 것만 남기고 삭제)
-- 주의: 삭제 전 위 STEP 2 결과를 반드시 확인하세요!
-- ============================================================
DELETE FROM order_accounts
WHERE id IN (
    SELECT id FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY account_id, slot_number 
                ORDER BY assigned_at ASC  -- 가장 오래된 데이터를 남김
            ) AS rn
        FROM order_accounts
    ) t
    WHERE rn > 1
);


-- ============================================================
-- STEP 5. [검증] 정리 후 중복 없는지 최종 확인 (모두 0건이어야 함)
-- ============================================================

-- tidal_id 중복 확인 (결과: 0건이어야 정상)
SELECT 'tidal_id 중복' AS check_type, COUNT(*) AS count FROM (
    SELECT tidal_id
    FROM order_accounts
    WHERE tidal_id IS NOT NULL AND tidal_id != ''
    GROUP BY tidal_id
    HAVING COUNT(*) > 1
) t;

-- (account_id, slot_number) 중복 확인 (결과: 0건이어야 정상)
SELECT '슬롯 중복' AS check_type, COUNT(*) AS count FROM (
    SELECT account_id, slot_number
    FROM order_accounts
    GROUP BY account_id, slot_number
    HAVING COUNT(*) > 1
) t;

-- ============================================================
-- 위 검증에서 모두 0건 확인 후 020_add_unique_tidal_id.sql 실행!
-- ============================================================
