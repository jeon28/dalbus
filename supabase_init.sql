-- Supabase 초기화 스크립트 (Dalbus)

-- 1. 서비스 테이블 (Tidal, Netflix 등)
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    icon TEXT, -- 아이콘 이름 (예: 'tidal')
    price INTEGER NOT NULL DEFAULT 4900,
    tag TEXT DEFAULT 'PREMIUM',
    color TEXT DEFAULT '#000000',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 초기 데이터 삽입
INSERT INTO services (name, icon, price, tag, color)
VALUES ('TIDAL HI-FI', 'tidal', 4900, 'PREMIUM', '#000000');

-- 2. 사용자 프로필 테이블 (Supabase Auth와 연동)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    name TEXT,
    phone TEXT,
    email TEXT,
    ci_di TEXT, -- 본인인증 식별값
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. 주문 테이블
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users ON DELETE SET NULL,
    service_id UUID REFERENCES services ON DELETE RESTRICT,
    duration_months INTEGER NOT NULL DEFAULT 1,
    amount INTEGER NOT NULL,
    payment_status TEXT DEFAULT '대기' CHECK (payment_status IN ('대기', '완료', '취소')),
    work_status TEXT DEFAULT '접수' CHECK (work_status IN ('접수', '작업중', '완료')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. 공유 계정 정보 테이블
CREATE TABLE shared_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID REFERENCES services ON DELETE RESTRICT,
    account_id TEXT NOT NULL,
    account_pw TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    order_id UUID REFERENCES orders ON DELETE SET NULL, -- 어떤 주문에 배정되었는지
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Row Level Security) 설정 예시
-- profiles는 본인만 접근 가능
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- services는 누구나 읽기 가능
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Services are public" ON services FOR SELECT TO public USING (true);

-- orders는 본인 것만 읽기 가능
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
