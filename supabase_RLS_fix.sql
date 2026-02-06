-- RLS 정책 수정: 어드민 페이지에서 모든 주문과 프로필을 볼 수 있도록 허용 (프로토타입용)

-- 1. profiles 테이블 정책 수정
-- 기존 정책 삭제 (이름이 다를 수 있으니 주의, 만약 에러나면 수동으로 삭제 필요)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- 모든 인증된 사용자가 모든 프로필을 읽을 수 있도록 허용 (어드민 대시보드용)
CREATE POLICY "Authenticated users can view all profiles" ON profiles 
FOR SELECT TO authenticated USING (true);

-- 사용자가 자신의 프로필을 생성할 수 있도록 허용 (회원가입용)
CREATE POLICY "Users can insert their own profile" ON profiles 
FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- 2. orders 테이블 정책 수정
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;

-- 모든 인증된 사용자가 모든 주문을 읽을 수 있도록 허용 (어드민 대시보드용)
CREATE POLICY "Authenticated users can view all orders" ON orders 
FOR SELECT TO authenticated USING (true);

-- 사용자가 주문을 생성할 수 있도록 허용 (결제용)
CREATE POLICY "Users can insert their own orders" ON orders 
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 3. shared_accounts 테이블 정책 추가 (필요 시)
ALTER TABLE shared_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view all shared accounts" ON shared_accounts 
FOR SELECT TO authenticated USING (true);
