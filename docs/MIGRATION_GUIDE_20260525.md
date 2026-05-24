# 운영 DB 마이그레이션 적용 가이드 (2026-05-25)

**대상 마이그레이션:** `supabase/migrations/20260525_add_match_code_and_bank_assignment_to_orders.sql`
**적용 위치:** Supabase Dashboard → SQL Editor
**원칙:** 사전 점검 → 트랜잭션 적용 → 사후 검증 (실패 시 자동 롤백)

---

## ⚠️ 적용 전 필수 확인 사항

1. **백업 권장**: Supabase Dashboard → Database → Backups 에서 최신 백업 시점 확인
2. **트래픽 적은 시간대 권장**: 마이그레이션 자체는 빠르지만 신규 트리거가 전체 INSERT 동작을 변경함
3. **순서 중요**: Step 1 → 2 → 3 순서로 진행. Step 2에서 에러 발생 시 자동 ROLLBACK

---

## Step 1. 사전 점검 (READ ONLY, 안전)

Supabase SQL Editor 에서 아래 쿼리들을 **차례로** 실행하여 현재 상태를 확인하세요.

### 1-1. 컬럼 미존재 확인
```sql
-- 결과가 0행이어야 정상 (이미 적용된 컬럼이 없음)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name IN ('match_code', 'assigned_bank_account_id', 'payment_due_at');
```

### 1-2. 활성 계좌 최소 1개 존재 확인
```sql
-- 1행 이상이어야 정상 (없으면 신규 주문 생성 실패)
SELECT id, bank_name, account_number, account_holder, is_active, sort_order
FROM bank_accounts
WHERE is_active = true
ORDER BY sort_order;
```

### 1-3. pending 주문 개수 확인 (백필 대상)
```sql
-- 백필 대상 건수 확인용
SELECT COUNT(*) AS pending_count
FROM orders
WHERE payment_status = 'pending';
```

### 1-4. 기존 트리거 충돌 여부 확인
```sql
-- 'orders_payment_defaults_trigger' 행이 없어야 정상
SELECT tgname
FROM pg_trigger
WHERE tgrelid = 'public.orders'::regclass
  AND NOT tgisinternal;
```

---

## Step 2. 마이그레이션 적용 (트랜잭션)

**중요:** 아래 SQL **전체를 한 번에 복사**해서 SQL Editor 에 붙여넣고 실행하세요.
`BEGIN ... COMMIT` 트랜잭션으로 감싸져 있어 중간에 실패하면 자동 ROLLBACK 됩니다.

```sql
BEGIN;

-- ============================================
-- 1. orders 테이블에 컬럼 추가
-- ============================================
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS match_code TEXT,
    ADD COLUMN IF NOT EXISTS assigned_bank_account_id UUID REFERENCES bank_accounts(id),
    ADD COLUMN IF NOT EXISTS payment_due_at TIMESTAMPTZ;

-- ============================================
-- 2. 인덱스
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS orders_match_code_unique
    ON orders (match_code)
    WHERE match_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_assigned_bank_account_idx
    ON orders (assigned_bank_account_id);

CREATE INDEX IF NOT EXISTS orders_payment_due_at_idx
    ON orders (payment_due_at)
    WHERE payment_status = 'pending';

-- ============================================
-- 3. match_code 생성 함수
-- ============================================
CREATE OR REPLACE FUNCTION generate_match_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    code TEXT;
    attempt INT := 0;
    max_attempts INT := 20;
BEGIN
    LOOP
        code := '';
        FOR i IN 1..4 LOOP
            code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
        END LOOP;

        IF NOT EXISTS (
            SELECT 1 FROM orders
            WHERE match_code = code
              AND payment_status IN ('pending')
        ) THEN
            RETURN code;
        END IF;

        attempt := attempt + 1;
        IF attempt >= max_attempts THEN
            code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
            RETURN code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. INSERT 트리거
-- ============================================
CREATE OR REPLACE FUNCTION set_order_payment_defaults()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.match_code IS NULL THEN
        NEW.match_code := generate_match_code();
    END IF;

    IF NEW.payment_due_at IS NULL THEN
        NEW.payment_due_at := NOW() + INTERVAL '48 hours';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_payment_defaults_trigger ON orders;
CREATE TRIGGER orders_payment_defaults_trigger
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION set_order_payment_defaults();

-- ============================================
-- 5. 기존 pending 주문 백필
-- ============================================
UPDATE orders
SET match_code = generate_match_code()
WHERE match_code IS NULL
  AND payment_status = 'pending';

UPDATE orders
SET payment_due_at = COALESCE(created_at, NOW()) + INTERVAL '48 hours'
WHERE payment_due_at IS NULL
  AND payment_status = 'pending';

COMMIT;
```

### 에러 발생 시
- 트랜잭션이 자동 ROLLBACK 되므로 DB 상태는 변경 없음
- 에러 메시지를 그대로 복사해서 전달해주세요
- 가장 흔한 원인: `bank_accounts` 테이블 미존재(드물지만), 권한 부족

---

## Step 3. 사후 검증

마이그레이션 후 아래 쿼리들로 결과를 확인하세요.

### 3-1. 컬럼 추가 확인
```sql
-- match_code, assigned_bank_account_id, payment_due_at 3개 행이 보여야 함
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name IN ('match_code', 'assigned_bank_account_id', 'payment_due_at')
ORDER BY column_name;
```

### 3-2. 트리거 등록 확인
```sql
-- 'orders_payment_defaults_trigger' 행이 보여야 함
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.orders'::regclass
  AND tgname = 'orders_payment_defaults_trigger';
```

### 3-3. 함수 등록 확인
```sql
-- 'generate_match_code', 'set_order_payment_defaults' 2개 행이 보여야 함
SELECT proname
FROM pg_proc
WHERE proname IN ('generate_match_code', 'set_order_payment_defaults');
```

### 3-4. 백필 결과 확인
```sql
-- pending 주문의 match_code, payment_due_at 이 모두 채워졌는지 확인
SELECT
    COUNT(*) AS total_pending,
    COUNT(match_code) AS with_match_code,
    COUNT(payment_due_at) AS with_due_at
FROM orders
WHERE payment_status = 'pending';
-- total_pending == with_match_code == with_due_at 이면 정상
```

### 3-5. 함수 동작 테스트 (DB 변경 없음)
```sql
-- match_code 생성 함수가 정상 동작하는지 5회 호출 테스트
SELECT generate_match_code() AS code_1,
       generate_match_code() AS code_2,
       generate_match_code() AS code_3,
       generate_match_code() AS code_4,
       generate_match_code() AS code_5;
-- 모두 4자리 영숫자, 서로 다른 값이어야 정상
```

---

## Step 4. 애플리케이션 검증 (시간 여유 후 진행)

### 4-1. 신규 주문 1건 테스트
1. 상품 페이지에서 게스트로 주문 진행
2. 결제완료 페이지에서 다음 항목 확인:
   - 계좌번호, 매칭 코드 표시
   - 입금자명 자동 합성 (예: `홍길동A2BC`)
   - 카운트다운 동작
   - 복사 버튼 동작
3. 페이지 새로고침 후 동일 정보 재조회 확인 (sessionStorage 제거 효과)

### 4-2. 무인증 API 차단 확인
```bash
curl -i https://<운영도메인>/api/public/banks
# HTTP/2 410  → 정상 (Gone)
```

### 4-3. 어드민 확인
- `/admin/orders` 에서 신규 주문의 `match_code`, `assigned_bank_account_id`, `payment_due_at` 컬럼 데이터 존재 확인
- (UI 노출은 별도 작업 필요 — 본 마이그레이션 범위 외)

---

## 🔙 롤백 가이드 (긴급 시에만)

만약 적용 후 심각한 문제가 발견되면 아래 SQL로 롤백 가능합니다.
**주의:** 백필된 `match_code`, `payment_due_at` 데이터가 모두 손실됩니다.

```sql
BEGIN;

-- 트리거 제거
DROP TRIGGER IF EXISTS orders_payment_defaults_trigger ON orders;
DROP FUNCTION IF EXISTS set_order_payment_defaults();
DROP FUNCTION IF EXISTS generate_match_code();

-- 인덱스 제거
DROP INDEX IF EXISTS orders_match_code_unique;
DROP INDEX IF EXISTS orders_assigned_bank_account_idx;
DROP INDEX IF EXISTS orders_payment_due_at_idx;

-- 컬럼 제거 (주의: 데이터 손실)
ALTER TABLE orders
    DROP COLUMN IF EXISTS match_code,
    DROP COLUMN IF EXISTS assigned_bank_account_id,
    DROP COLUMN IF EXISTS payment_due_at;

COMMIT;
```

⚠️ 롤백 후에는 **신규 코드 배포도 함께 되돌려야** 합니다.
(이 마이그레이션 없이는 `/api/orders/[id]/payment-info` 가 정상 동작하지 않음)

---

## 적용 체크리스트

- [ ] Supabase Database → Backups 시점 확인
- [ ] Step 1 사전 점검 4개 쿼리 모두 통과
- [ ] Step 2 트랜잭션 SQL 실행 → "Success" 응답
- [ ] Step 3 사후 검증 5개 쿼리 모두 정상
- [ ] (선택) Step 4 애플리케이션 검증
- [ ] 코드 배포 (Vercel 등)
- [ ] 운영 환경에서 실제 주문 1건 테스트
