-- [Dalbus v2.0] Supabase Migration Script - Part 3: Seed Data

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
        '/tidal-logo.svg',
        1
    ) RETURNING id INTO tidal_id;

    INSERT INTO product_plans (product_id, duration_months, price, discount_rate)
    VALUES 
        (tidal_id, 1, 5900, 46.0),
        (tidal_id, 3, 14900, 55.0);
END $$;
