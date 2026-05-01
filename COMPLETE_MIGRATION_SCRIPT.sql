-- ============================================
-- Dalbus Complete Migration Script
-- Migrations 018, 019, 020 통합 실행
-- ============================================
-- 주의: 반드시 Supabase SQL Editor에서 실행하세요
-- ============================================

-- ============================================
-- STEP 1: 현재 상태 확인
-- ============================================

SELECT '===== STEP 1: Current State Check =====' as step;

-- 1-1. accounts.login_pw nullable 확인
SELECT
    'accounts.login_pw' as column_info,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'accounts' AND column_name = 'login_pw';

-- 1-2. order_accounts.order_id nullable 확인
SELECT
    'order_accounts.order_id' as column_info,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'order_accounts' AND column_name = 'order_id';

-- 1-3. 기존 constraints 확인
SELECT
    'Existing constraints' as info,
    conname AS constraint_name
FROM pg_constraint
WHERE conrelid = 'order_accounts'::regclass
AND conname IN ('order_accounts_tidal_id_key', 'order_accounts_account_slot_key');

-- ============================================
-- STEP 2: Migration 018 - accounts.login_pw nullable
-- ============================================

SELECT '===== STEP 2: Migration 018 (login_pw nullable) =====' as step;

DO $$
BEGIN
    -- login_pw를 nullable로 변경
    ALTER TABLE public.accounts ALTER COLUMN login_pw DROP NOT NULL;
    RAISE NOTICE 'Migration 018 completed: login_pw is now nullable';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Migration 018 skipped or failed: %', SQLERRM;
END $$;

-- ============================================
-- STEP 3: Migration 019 - order_accounts.order_id nullable
-- ============================================

SELECT '===== STEP 3: Migration 019 (order_id nullable) =====' as step;

DO $$
BEGIN
    -- order_id를 nullable로 변경
    ALTER TABLE public.order_accounts ALTER COLUMN order_id DROP NOT NULL;
    RAISE NOTICE 'Migration 019 completed: order_id is now nullable';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Migration 019 skipped or failed: %', SQLERRM;
END $$;

-- ============================================
-- STEP 4: 중복 데이터 확인 및 정리
-- ============================================

SELECT '===== STEP 4: Check and Clean Duplicates =====' as step;

-- 4-1. 중복 tidal_id 확인
SELECT
    '중복된 tidal_id' as info,
    tidal_id,
    COUNT(*) as duplicate_count
FROM order_accounts
WHERE tidal_id IS NOT NULL AND tidal_id != ''
GROUP BY tidal_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 4-2. 중복 삭제 (가장 오래된 것만 유지)
DELETE FROM order_accounts
WHERE id IN (
    SELECT id
    FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY tidal_id
                ORDER BY assigned_at ASC NULLS LAST
            ) as rn
        FROM order_accounts
        WHERE tidal_id IS NOT NULL AND tidal_id != ''
    ) t
    WHERE rn > 1
);

-- 4-3. 중복 제거 확인 (결과 0개여야 함)
SELECT
    '중복 제거 후 확인' as info,
    tidal_id,
    COUNT(*) as should_be_one
FROM order_accounts
WHERE tidal_id IS NOT NULL AND tidal_id != ''
GROUP BY tidal_id
HAVING COUNT(*) > 1;

-- ============================================
-- STEP 5: Migration 020 - Unique Constraints
-- ============================================

SELECT '===== STEP 5: Migration 020 (unique constraints) =====' as step;

DO $$
BEGIN
    -- tidal_id UNIQUE constraint 추가
    ALTER TABLE public.order_accounts
    ADD CONSTRAINT order_accounts_tidal_id_key UNIQUE (tidal_id);
    RAISE NOTICE 'Constraint order_accounts_tidal_id_key added';
EXCEPTION
    WHEN duplicate_table THEN
        RAISE NOTICE 'Constraint order_accounts_tidal_id_key already exists';
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Cannot add constraint: duplicate tidal_id still exists. Run STEP 4 again.';
    WHEN OTHERS THEN
        RAISE NOTICE 'Constraint order_accounts_tidal_id_key failed: %', SQLERRM;
END $$;

DO $$
BEGIN
    -- (account_id, slot_number) UNIQUE constraint 추가
    ALTER TABLE public.order_accounts
    ADD CONSTRAINT order_accounts_account_slot_key UNIQUE (account_id, slot_number);
    RAISE NOTICE 'Constraint order_accounts_account_slot_key added';
EXCEPTION
    WHEN duplicate_table THEN
        RAISE NOTICE 'Constraint order_accounts_account_slot_key already exists';
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Cannot add constraint: duplicate (account_id, slot_number) exists.';
    WHEN OTHERS THEN
        RAISE NOTICE 'Constraint order_accounts_account_slot_key failed: %', SQLERRM;
END $$;

-- ============================================
-- STEP 6: 최종 검증
-- ============================================

SELECT '===== STEP 6: Final Verification =====' as step;

-- 6-1. Nullable 확인
SELECT
    table_name,
    column_name,
    is_nullable,
    CASE WHEN is_nullable = 'YES' THEN '✅ OK' ELSE '❌ FAIL' END as status
FROM information_schema.columns
WHERE (table_name = 'accounts' AND column_name = 'login_pw')
   OR (table_name = 'order_accounts' AND column_name = 'order_id')
ORDER BY table_name, column_name;

-- 6-2. Constraints 확인
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS definition,
    '✅ OK' as status
FROM pg_constraint
WHERE conrelid = 'order_accounts'::regclass
AND conname IN ('order_accounts_tidal_id_key', 'order_accounts_account_slot_key');

-- 6-3. 중복 최종 확인 (결과 0개여야 함)
SELECT
    '중복 최종 확인 (0개여야 함)' as info,
    COUNT(*) as duplicate_count
FROM (
    SELECT tidal_id
    FROM order_accounts
    WHERE tidal_id IS NOT NULL AND tidal_id != ''
    GROUP BY tidal_id
    HAVING COUNT(*) > 1
) duplicates;

-- ============================================
-- STEP 7: used_slots 동기화 (선택사항)
-- ============================================

SELECT '===== STEP 7: Sync used_slots (Optional) =====' as step;

-- 모든 계정의 used_slots를 실제 배정 개수로 동기화
UPDATE accounts a
SET used_slots = (
    SELECT COUNT(*)
    FROM order_accounts oa
    WHERE oa.account_id = a.id
);

-- 동기화 결과 확인
SELECT
    '동기화 완료' as info,
    a.login_id,
    a.used_slots,
    a.max_slots,
    CONCAT(a.used_slots, '/', a.max_slots) as slots_status
FROM accounts a
WHERE a.used_slots > 0
ORDER BY a.created_at DESC
LIMIT 10;

-- ============================================
-- 완료
-- ============================================

SELECT '===== ✅ All Migrations Completed =====' as final_message;
SELECT '이제 Excel 임포트를 다시 시도하세요: https://dalbus.vercel.app/admin/tidal' as next_step;
