-- [Dalbus v2.0] Supabase Migration Script - Part 2: RLS Policies

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
