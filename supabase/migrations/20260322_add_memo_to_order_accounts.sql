-- order_accounts 테이블에 memo 컬럼 추가
ALTER TABLE order_accounts ADD COLUMN IF NOT EXISTS memo TEXT;

-- admin 사용자는 마음대로 읽고 쓸 수 있어야 하지만 기본적으로 RLS는 기존 정책을 따릅니다.
