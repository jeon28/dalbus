-- [Dalbus v2.0] Sample Test Data for Manual Testing

-- 1. Notices (공지사항)
INSERT INTO notices (title, content, category, is_published, is_pinned)
VALUES 
    ('달버스 서비스 정식 오픈 안내', '안녕하세요, 달버스입니다. 고품질 공유 계정 서비스를 정식으로 시작합니다.', 'service', true, true),
    ('시스템 정기 점검 안내 (2/10)', '안정적인 서비스를 위해 2월 10일 새벽 2시부터 4시까지 점검이 진행됩니다.', 'maintenance', true, false),
    ('신규 서비스 "Spotify" 출시 예정', '조금만 기다려주세요! 이제 Spotify도 달버스에서 만나보실 수 있습니다.', 'update', true, false),
    ('설 연휴 고객센터 운영 안내', '설 연휴 기간 동안은 톡톡 상담 답변이 지연될 수 있습니다.', 'service', true, false);

-- 2. FAQ (자주 묻는 질문)
INSERT INTO faqs (question, answer, category, sort_order, is_published)
VALUES 
    ('비밀번호를 잊어버렸어요.', '로그인 화면의 "비밀번호 찾기"를 통해 이메일로 임시 비밀번호를 받으실 수 있습니다.', 'account', 1, true),
    ('계정 정보는 언제 받을 수 있나요?', '결제 완료 후 "마이페이지"에서 즉시 확인 가능하며, 카카오톡 알림톡으로도 발송됩니다.', 'account', 2, true),
    ('결제 수단은 어떤 것들이 있나요?', '현재 카카오페이, 네이버페이, 신용카드 결제를 지원하고 있습니다.', 'payment', 1, true),
    ('환불은 어떻게 진행되나요?', '이용 시작 7일 이내에 문제가 발생한 경우 고객센터를 통해 100% 환불이 가능합니다.', 'refund', 1, true);

-- 3. Sample Accounts (공유 계정 풀)
-- 기존 Tidal 상품이 있는지 확인 후 삽입
DO $$
DECLARE
    tidal_id UUID;
BEGIN
    -- Update existing product image path if needed
    UPDATE products SET image_url = '/tidal-logo.svg' WHERE slug = 'tidal-hifi';

    SELECT id INTO tidal_id FROM products WHERE slug = 'tidal-hifi' LIMIT 1;
    
    IF tidal_id IS NOT NULL THEN
        INSERT INTO accounts (product_id, login_id, login_pw, status, max_slots, used_slots, memo)
        VALUES 
            (tidal_id, 'tidal_premium_01@gmail.com', 'dalbus1234!', 'available', 5, 0, '2026-12-31 만료 예정'),
            (tidal_id, 'tidal_premium_02@gmail.com', 'dalbus5678!', 'available', 5, 2, '안정적인 계정'),
            (tidal_id, 'tidal_premium_03@gmail.com', 'dalbus9999!', 'disabled', 5, 5, '만료됨');
    END IF;
END $$;

-- 4. Sample Orders (주문 내역)
-- 테스트를 위해 기존 사용자가 한 명이라도 있어야 함.
-- 만약 없으면 아래 쿼리는 아무것도 생성하지 않음.
DO $$
DECLARE
    tidal_id UUID;
    user_id UUID;
    plan_id UUID;
BEGIN
    SELECT id INTO tidal_id FROM products WHERE slug = 'tidal-hifi' LIMIT 1;
    SELECT id INTO user_id FROM profiles LIMIT 1;
    SELECT id INTO plan_id FROM product_plans WHERE product_id = tidal_id LIMIT 1;
    
    IF tidal_id IS NOT NULL AND user_id IS NOT NULL AND plan_id IS NOT NULL THEN
        -- 최근 10건의 무작위 주문 생성
        FOR i IN 1..10 LOOP
            INSERT INTO orders (
                user_id, 
                product_id, 
                plan_id, 
                amount, 
                payment_status, 
                assignment_status, 
                paid_at, 
                created_at,
                start_date,
                end_date
            )
            VALUES (
                user_id,
                tidal_id,
                plan_id,
                5900,
                'paid',
                CASE WHEN i % 3 = 0 THEN 'waiting'::assignment_status ELSE 'assigned'::assignment_status END,
                NOW() - (i || ' hours')::INTERVAL,
                NOW() - (i || ' hours')::INTERVAL,
                CURRENT_DATE,
                CURRENT_DATE + INTERVAL '1 month'
            );
        END LOOP;
    END IF;
END $$;
