-- 입금 요청 메일 기능
-- 1) orders.deposit_requested_at : 마지막 입금요청 메일 발송 시각
-- 2) email_templates 'DEPOSIT_REQUEST' 템플릿 시드 (관리자 > 메일 템플릿에서 수정 가능)

ALTER TABLE orders ADD COLUMN IF NOT EXISTS deposit_requested_at TIMESTAMPTZ;

INSERT INTO email_templates (key, name, subject, content, placeholders)
VALUES
('DEPOSIT_REQUEST', '입금 요청 안내', '[Dalbus] 입금 요청 안내 - {buyer_name}님',
'<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
  <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">입금 요청 안내</h2>
  <p>안녕하세요, <strong>{buyer_name}</strong>님! Dalbus를 이용해 주셔서 감사합니다.</p>
  <p>주문하신 서비스의 입금이 아직 확인되지 않았습니다. 아래 계좌로 입금해 주시면 확인 후 바로 계정 세팅을 진행해 드리겠습니다.</p>
  <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 5px 0;"><strong>주문 번호:</strong> {order_id}</p>
    <p style="margin: 5px 0;"><strong>상품명:</strong> {product_name}</p>
    <p style="margin: 5px 0;"><strong>요금제:</strong> {plan_name}</p>
    <p style="margin: 5px 0;"><strong>입금 금액:</strong> {amount}원</p>
    <p style="margin: 5px 0;"><strong>입금자명:</strong> {depositor_name}</p>
  </div>
  <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 5px 0; font-weight: bold; color: #1d4ed8;">입금 계좌</p>
    <p style="margin: 5px 0;"><strong>은행:</strong> {bank_name}</p>
    <p style="margin: 5px 0;"><strong>계좌번호:</strong> {account_number}</p>
    <p style="margin: 5px 0;"><strong>예금주:</strong> {account_holder}</p>
    <p style="margin: 5px 0;"><strong>입금 기한:</strong> {payment_due_at}</p>
  </div>
  <p>입금자명이 주문 시 입력하신 이름과 다를 경우 확인이 지연될 수 있으니, 가능하면 <strong>{depositor_name}</strong> 명의로 입금해 주세요.</p>
  <p>이미 입금하셨다면 이 메일은 무시하셔도 됩니다. 확인 후 안내 메일을 보내드리겠습니다.</p>
  <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
  <p style="font-size: 0.8rem; color: #666;">본 메일은 발신전용입니다. 문의사항은 관리자 페이지 또는 고객센터를 이용해 주세요.</p>
</div>',
'[{"key": "buyer_name", "label": "구매자명"}, {"key": "order_id", "label": "주문번호"}, {"key": "product_name", "label": "상품명"}, {"key": "plan_name", "label": "요금제"}, {"key": "amount", "label": "결제금액"}, {"key": "depositor_name", "label": "입금자명"}, {"key": "bank_name", "label": "은행명"}, {"key": "account_number", "label": "계좌번호"}, {"key": "account_holder", "label": "예금주"}, {"key": "payment_due_at", "label": "입금기한"}]')
ON CONFLICT (key) DO NOTHING;
