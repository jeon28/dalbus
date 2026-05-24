-- ============================================
-- 무통장 입금 운영 강화: 주문별 계좌 할당 + 매칭 코드
-- ============================================
-- 목적:
--   1. 결제 안내 시점에 계좌를 모두 노출하지 않고, 주문별로 1개만 할당하여 노출
--   2. 입금자명 위장 공격 방어를 위한 4자리 매칭 코드 부착
--   3. 입금 마감 시간 명시로 미입금 주문 자동 만료 운영
-- ============================================

-- 1. orders 테이블에 컬럼 추가
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS match_code TEXT,
    ADD COLUMN IF NOT EXISTS assigned_bank_account_id UUID REFERENCES bank_accounts(id),
    ADD COLUMN IF NOT EXISTS payment_due_at TIMESTAMPTZ;

-- 2. match_code 유니크 제약 (NULL 허용: 기존 레코드 보호)
CREATE UNIQUE INDEX IF NOT EXISTS orders_match_code_unique
    ON orders (match_code)
    WHERE match_code IS NOT NULL;

-- 3. 매칭/조회 성능을 위한 보조 인덱스
CREATE INDEX IF NOT EXISTS orders_assigned_bank_account_idx
    ON orders (assigned_bank_account_id);
CREATE INDEX IF NOT EXISTS orders_payment_due_at_idx
    ON orders (payment_due_at)
    WHERE payment_status = 'pending';

-- 4. match_code 생성 함수
--    영숫자 4자리, 사용자가 혼동하기 쉬운 문자(0/O, 1/I/L) 제외
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

        -- 중복 검사 (pending 상태 주문 중에서만 충돌 검사)
        IF NOT EXISTS (
            SELECT 1 FROM orders
            WHERE match_code = code
              AND payment_status IN ('pending')
        ) THEN
            RETURN code;
        END IF;

        attempt := attempt + 1;
        IF attempt >= max_attempts THEN
            -- 비현실적인 충돌 상황: 5자리로 fallback
            code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
            RETURN code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. 주문 INSERT 트리거: match_code 및 payment_due_at 자동 설정
CREATE OR REPLACE FUNCTION set_order_payment_defaults()
RETURNS TRIGGER AS $$
BEGIN
    -- match_code 미지정 시 자동 생성
    IF NEW.match_code IS NULL THEN
        NEW.match_code := generate_match_code();
    END IF;

    -- payment_due_at 미지정 시 48시간 후로 자동 설정
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

-- 6. 기존 pending 주문에 대해 백필 (운영 중인 데이터 보호)
UPDATE orders
SET match_code = generate_match_code()
WHERE match_code IS NULL
  AND payment_status = 'pending';

UPDATE orders
SET payment_due_at = COALESCE(created_at, NOW()) + INTERVAL '48 hours'
WHERE payment_due_at IS NULL
  AND payment_status = 'pending';
