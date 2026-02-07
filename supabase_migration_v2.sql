-- [Dalbus v2.0] Supabase Migration Script
-- 기존 테이블을 백업하거나 삭제하고 v2.0 스키마를 적용합니다.
-- 주의: 이 스크립트는 기존 데이터를 삭제할 수 있습니다. 운영 환경 적용 전 백업 필수!

-- ============================================
-- 0. 기존 테이블 정리 (Clean Slate)
-- ============================================
DROP TABLE IF EXISTS notification_logs CASCADE;
DROP TABLE IF EXISTS faqs CASCADE;
DROP TABLE IF EXISTS notices CASCADE;
DROP TABLE IF EXISTS order_accounts CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS product_plans CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 기존 v1 테이블이 있다면 삭제 (services, shared_accounts 등)
DROP TABLE IF EXISTS shared_accounts CASCADE;
DROP TABLE IF EXISTS services CASCADE;

-- ENUM 타입 정리
DROP TYPE IF EXISTS notification_status;
DROP TYPE IF EXISTS notification_channel;
DROP TYPE IF EXISTS notification_type;
DROP TYPE IF EXISTS faq_category;
DROP TYPE IF EXISTS notice_category;
DROP TYPE IF EXISTS account_status;
DROP TYPE IF EXISTS assignment_status;
DROP TYPE IF EXISTS payment_status;
DROP TYPE IF EXISTS user_role;

-- ============================================
-- 1. ENUM 및 타입 정의
-- ============================================
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'cancelled', 'refunded');
CREATE TYPE assignment_status AS ENUM ('waiting', 'assigned', 'expired', 'replaced');
CREATE TYPE account_status AS ENUM ('available', 'assigned', 'disabled');
CREATE TYPE notice_category AS ENUM ('service', 'update', 'event', 'maintenance');
CREATE TYPE faq_category AS ENUM ('general', 'payment', 'account', 'refund');
CREATE TYPE notification_type AS ENUM ('assignment', 'expiry_d7', 'expiry_d1', 'replacement', 'delay');
CREATE TYPE notification_channel AS ENUM ('sms', 'alimtalk');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');

-- ============================================
-- 2. 테이블 생성
-- ============================================

-- (1) profiles: 사용자 프로필 (Auth 연동)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (2) products: 구독 상품 (서비스)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    original_price INTEGER NOT NULL,
    benefits TEXT[] DEFAULT '{}',
    cautions TEXT[] DEFAULT '{}',
    image_url TEXT,
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (3) product_plans: 상품별 요금제 (기간권)
CREATE TABLE product_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    duration_months INTEGER NOT NULL,
    price INTEGER NOT NULL,
    discount_rate NUMERIC(5,2) DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, duration_months)
);

-- (4) accounts: 공유 계정 풀
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    login_id TEXT NOT NULL,  -- 실제 운영 시 pgcrypto 등으로 암호화 권장
    login_pw TEXT NOT NULL,  -- 실제 운영 시 pgcrypto 등으로 암호화 권장
    status account_status NOT NULL DEFAULT 'available',
    max_slots INTEGER NOT NULL DEFAULT 1, -- 독립 계정이면 1, 파티면 4~5
    used_slots INTEGER NOT NULL DEFAULT 0,
    memo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT slots_check CHECK (used_slots <= max_slots)
);

-- (5) orders: 주문 및 이용권
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    product_id UUID NOT NULL REFERENCES products(id),
    plan_id UUID NOT NULL REFERENCES product_plans(id),
    amount INTEGER NOT NULL,
    payment_status payment_status NOT NULL DEFAULT 'pending',
    assignment_status assignment_status NOT NULL DEFAULT 'waiting',
    portone_payment_id TEXT,
    paid_at TIMESTAMPTZ,
    assigned_at TIMESTAMPTZ,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (6) order_accounts: 주문-계정 매핑 로그 (다대다 가능성 대비)
CREATE TABLE order_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (7) notices & faqs & logs
CREATE TABLE notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category notice_category NOT NULL DEFAULT 'service',
    is_published BOOLEAN NOT NULL DEFAULT false,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category faq_category NOT NULL DEFAULT 'general',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    order_id UUID REFERENCES orders(id),
    type notification_type NOT NULL,
    channel notification_channel NOT NULL DEFAULT 'sms',
    status notification_status NOT NULL DEFAULT 'pending',
    message TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. 트리거 및 함수 설정
-- ============================================

-- Profile 자동 생성 트리거
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        'user' -- 기본값
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 주문번호 자동 생성 트리거
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
    seq_num INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO seq_num
    FROM orders
    WHERE DATE(created_at) = CURRENT_DATE;

    NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(seq_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_number_trigger ON orders;
CREATE TRIGGER orders_number_trigger
    BEFORE INSERT ON orders
    FOR EACH ROW
    WHEN (NEW.order_number IS NULL)
    EXECUTE FUNCTION generate_order_number();

-- ============================================
-- 4. RLS (Row Level Security) 설정
-- ============================================

-- RLS 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Helper Function: Admin Check
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (is_admin());

-- Products/Plans Policies (Public Read, Admin Write)
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Admin write products" ON products FOR ALL USING (is_admin());
CREATE POLICY "Public read plans" ON product_plans FOR SELECT USING (true);
CREATE POLICY "Admin write plans" ON product_plans FOR ALL USING (is_admin());

-- Orders Policies
CREATE POLICY "Users view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all orders" ON orders FOR ALL USING (is_admin());

-- Accounts Policies (Admin Only)
CREATE POLICY "Admins manage accounts" ON accounts FOR ALL USING (is_admin());

-- Notices/FAQs Policies
CREATE POLICY "Public read notices" ON notices FOR SELECT USING (is_published = true OR is_admin());
CREATE POLICY "Admins manage notices" ON notices FOR ALL USING (is_admin());
CREATE POLICY "Public read faqs" ON faqs FOR SELECT USING (is_published = true OR is_admin());
CREATE POLICY "Admins manage faqs" ON faqs FOR ALL USING (is_admin());

-- ============================================
-- 5. 초기 데이터 시딩 (Seed Data)
-- ============================================

-- Tidal 상품 예시
DO $$
DECLARE
    tidal_id UUID;
BEGIN
    INSERT INTO products (slug, name, original_price, description, benefits, image_url, sort_order)
    VALUES (
        'tidal-hifi',
        'Tidal HiFi Plus',
        10990,
        '무손실 음원을 광고 없이 감상하세요.',
        ARRAY['무손실 Hi-Fi 음질', '오프라인 저장', '광고 제거'],
        '/images/services/tidal.png',
        1
    ) RETURNING id INTO tidal_id;

    INSERT INTO product_plans (product_id, duration_months, price, discount_rate)
    VALUES 
        (tidal_id, 1, 5900, 46.0),
        (tidal_id, 3, 14900, 55.0);
END $$;
