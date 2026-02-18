import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

interface OrderNotificationProps {
    orderId: string;
    productName: string;
    planName: string;
    amount: number;
    buyerName: string;
    buyerPhone: string | null;
    depositorName: string;
}

export const sendAdminOrderNotification = async (
    adminEmail: string,
    order: OrderNotificationProps
) => {
    if (!resend) {
        console.error('RESEND_API_KEY is missing. Email notification skipped.');
        return { success: false, error: 'Missing API Key' };
    }

    try {
        const { orderId, productName, planName, amount, buyerName, buyerPhone, depositorName } = order;

        const { data, error } = await resend.emails.send({
            from: 'Dalbus <onboarding@resend.dev>', // Default Resend sender, change for production
            to: [adminEmail],
            subject: `[Dalbus] 신규 주문 알림 - ${buyerName}님`,
            html: `
        <h1>신규 주문이 접수되었습니다!</h1>
        <p><strong>주문 번호:</strong> ${orderId}</p>
        <hr />
        <h3>주문 상세</h3>
        <ul>
          <li><strong>상품:</strong> ${productName}</li>
          <li><strong>요금제:</strong> ${planName}</li>
          <li><strong>결제 금액:</strong> ${amount.toLocaleString()}원</li>
        </ul>
        <hr />
        <h3>구매자 정보</h3>
        <ul>
          <li><strong>구매자명:</strong> ${buyerName}</li>
          <li><strong>입금자명:</strong> ${depositorName}</li>
          <li><strong>연락처:</strong> ${buyerPhone || '정보 없음'}</li>
        </ul>
        <hr />
        <p>관리자 페이지에서 입금 확인 후 배정을 진행해주세요.</p>
        <a href="${process.env.NEXT_PUBLIC_SITE_URL}/admin/orders">관리자 페이지 바로가기</a>
      `,
        });

        if (error) {
            console.error('Email sending failed:', error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Unexpected error sending email:', error);
        return { success: false, error };
    }
};

interface ExpiryNotificationProps {
    buyerName: string;
    tidalId: string;
    endDate: string;
    message: string;
}

export const sendExpiryNotification = async (
    targetEmail: string,
    details: ExpiryNotificationProps
) => {
    if (!resend) {
        console.error('RESEND_API_KEY is missing. Email notification skipped.');
        return { success: false, error: 'Missing API Key' };
    }

    try {
        const { buyerName, tidalId, endDate, message } = details;

        const { data, error } = await resend.emails.send({
            from: 'Dalbus <onboarding@resend.dev>', // Default Resend sender, change for production
            to: [targetEmail],
            subject: `[Dalbus] 서비스 만료 안내 - ${buyerName}님`,
            html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #2563eb;">서비스 만료 안내</h2>
          <div style="white-space: pre-wrap; margin-bottom: 20px;">
${message.replace(/{buyer_name}/g, buyerName).replace(/{tidal_id}/g, tidalId).replace(/{end_date}/g, endDate)}
          </div>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 0.8rem; color: #666;">
            본 메일은 정보통신망법 등 관련 법령에 의거하여 발송되는 안내 메일입니다.
          </p>
        </div>
      `,
        });

        if (error) {
            console.error('Email sending failed:', error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Unexpected error sending email:', error);
        return { success: false, error };
    }
};
