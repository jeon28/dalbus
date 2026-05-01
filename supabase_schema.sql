-- email_templates 테이블 생성
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    placeholders JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at 자동 갱신 트리거 (이미 있는 경우 제외)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_email_templates') THEN
        CREATE TRIGGER set_updated_at_email_templates
        BEFORE UPDATE ON email_templates
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 기본 시드 데이터 삽입 (기존 email.ts 기반)
INSERT INTO email_templates (key, name, subject, content, placeholders)
VALUES 
('ORDER_RECEIVED_USER', '주문 접수 안내 (사용자)', '[Dalbus] 주문 접수 안내 - {buyer_name}님', 
'<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
  <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">주문이 정상적으로 접수되었습니다.</h2>
  <p>안녕하세요, <strong>{buyer_name}</strong>님! Dalbus를 이용해 주셔서 감사합니다.</p>
  <p>주문하신 서비스의 입금이 확인되면 계정 배정이 시작됩니다.</p>
  <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 5px 0;"><strong>주문 번호:</strong> {order_id}</p>
    <p style="margin: 5px 0;"><strong>상품명:</strong> {product_name}</p>
    <p style="margin: 5px 0;"><strong>요금제:</strong> {plan_name}</p>
    <p style="margin: 5px 0;"><strong>결제 금액:</strong> {amount}원</p>
    <p style="margin: 5px 0;"><strong>입금자명:</strong> {depositor_name}</p>
  </div>
  <p>관리자가 입금 확인 후 영업일 기준 24시간 이내에 계정 세팅을 완료해 드립니다.</p>
  <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
  <p style="font-size: 0.8rem; color: #666;">본 메일은 발신전용입니다.</p>
</div>', 
'[{"key": "buyer_name", "label": "구매자명"}, {"key": "order_id", "label": "주문번호"}, {"key": "product_name", "label": "상품명"}, {"key": "plan_name", "label": "요금제"}, {"key": "amount", "label": "결제금액"}, {"key": "depositor_name", "label": "입금자명"}]'),

('EXPIRY_NOTICE', '서비스 만료 안내', '[Dalbus] 서비스 만료 안내 - {buyer_name}님', 
'<div style="font-family: sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #2563eb;">서비스 만료 안내</h2>
  <div style="white-space: pre-wrap; margin-bottom: 20px;">
{message}
  </div>
  <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
  <p style="font-size: 0.8rem; color: #666;">본 메일은 정보통신망법 등 관련 법령에 의거하여 발송되는 안내 메일입니다.</p>
</div>', 
'[{"key": "buyer_name", "label": "구매자명"}, {"key": "tidal_id", "label": "타이달ID"}, {"key": "end_date", "label": "만료일"}]'),

('ASSIGNMENT_COMPLETE', '계정 세팅 완료 안내', '[Dalbus] 계정 세팅 완료 안내 - {buyer_name}님', 
'<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
  <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">계정 세팅 완료 안내</h2>
  <p>안녕하세요, <strong>{buyer_name}</strong>님!</p>
  <p>요청하신 <strong>{product_name}</strong> 서비스의 계정 세팅이 완료되었습니다.</p>
  <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 5px 0;"><strong>Tidal ID:</strong> {tidal_id}</p>
    <p style="margin: 5px 0;"><strong>Tidal PW:</strong> {tidal_pw}</p>
    <p style="margin: 5px 0;"><strong>만료 예정일:</strong> {end_date}</p>
  </div>
  <p>지금 바로 로그인하여 서비스를 이용하실 수 있습니다.</p>
  <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
  <p style="font-size: 0.8rem; color: #666;">본 메일은 발신전용입니다.</p>
</div>', 
'[{"key": "buyer_name", "label": "구매자명"}, {"key": "product_name", "label": "상품명"}, {"key": "tidal_id", "label": "타이달ID"}, {"key": "tidal_pw", "label": "타이달PW"}, {"key": "end_date", "label": "만료일"}]')
ON CONFLICT (key) DO NOTHING;
