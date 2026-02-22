import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const getSenderEmail = async (): Promise<string> => {
    try {
        const { data } = await supabaseAdmin
            .from('site_settings')
            .select('value')
            .eq('key', 'admin_sender_email')
            .single();

        if (data?.value) {
            return `Dalbus <${data.value}>`;
        }
    } catch (error) {
        console.error('Error fetching sender email:', error);
    }
    return 'Dalbus <onboarding@resend.dev>'; // Fallback
};

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
        const sender = await getSenderEmail();

        const { data, error } = await resend.emails.send({
            from: sender,
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
        <a href="https://dalbus.vercel.app/admin/orders">관리자 페이지 바로가기</a>
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

/**
 * 사용자용 주문 접수 알림 메일 발송
 */
export const sendUserOrderNotification = async (
    userEmail: string,
    order: OrderNotificationProps
) => {
    if (!resend) {
        console.error('RESEND_API_KEY is missing. Email notification skipped.');
        return { success: false, error: 'Missing API Key' };
    }

    try {
        const { orderId, productName, planName, amount, buyerName, depositorName } = order;
        const sender = await getSenderEmail();

        const { data, error } = await resend.emails.send({
            from: sender,
            to: [userEmail],
            subject: `[Dalbus] 주문 접수 안내 - ${buyerName}님`,
            html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">주문이 정상적으로 접수되었습니다.</h2>
          <p>안녕하세요, <strong>${buyerName}</strong>님! Dalbus를 이용해 주셔서 감사합니다.</p>
          <p>주문하신 서비스의 입금이 확인되면 계정 배정이 시작됩니다.</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>주문 번호:</strong> ${orderId}</p>
            <p style="margin: 5px 0;"><strong>상품명:</strong> ${productName}</p>
            <p style="margin: 5px 0;"><strong>요금제:</strong> ${planName}</p>
            <p style="margin: 5px 0;"><strong>결제 금액:</strong> ${amount.toLocaleString()}원</p>
            <p style="margin: 5px 0;"><strong>입금자명:</strong> ${depositorName}</p>
          </div>

          <p>관리자가 입금 확인 후 영업일 기준 24시간 이내에 계정 세팅을 완료해 드립니다.</p>
          <p>계정 배정 및 작업이 완료되면 다시 한번 안내 메일을 보내드리겠습니다.</p>
          
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 0.8rem; color: #666;">
            본 메일은 발신전용입니다. 문의사항은 관리자 페이지 또는 고객센터를 이용해 주세요.
          </p>
        </div>
      `,
        });

        if (error) {
            console.error('User Email sending failed:', error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Unexpected error sending user email:', error);
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
        const sender = await getSenderEmail();

        const { data, error } = await resend.emails.send({
            from: sender,
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

interface AssignmentNotificationProps {
    buyerName: string;
    productName: string;
    tidalId: string;
    tidalPw: string;
    endDate: string;
}

export const sendAssignmentNotification = async (
    targetEmail: string,
    details: AssignmentNotificationProps
) => {
    if (!resend) {
        console.error('RESEND_API_KEY is missing. Email notification skipped.');
        return { success: false, error: 'Missing API Key' };
    }

    try {
        const { buyerName, productName, tidalId, tidalPw, endDate } = details;
        const sender = await getSenderEmail();

        const { data, error } = await resend.emails.send({
            from: sender,
            to: [targetEmail],
            subject: `[Dalbus] 계정 세팅 완료 안내 - ${buyerName}님`,
            html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">계정 세팅 완료 안내</h2>
          <p>안녕하세요, <strong>${buyerName}</strong>님!</p>
          <p>요청하신 <strong>${productName}</strong> 서비스의 계정 세팅이 완료되었습니다.</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Tidal ID:</strong> ${tidalId}</p>
            <p style="margin: 5px 0;"><strong>Tidal PW:</strong> ${tidalPw}</p>
            <p style="margin: 5px 0;"><strong>만료 예정일:</strong> ${endDate}</p>
          </div>

          <p>지금 바로 로그인하여 서비스를 이용하실 수 있습니다.</p>
          <p>이용 중 궁금하신 점이 있다면 언제든 문의해 주세요.</p>
          
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 0.8rem; color: #666;">
            본 메일은 발신전용입니다. 문의사항은 관리자 페이지 또는 고객센터를 이용해 주세요.
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

/**
 * 비밀번호 초기화 인증번호 메일 발송
 */
export const sendPasswordResetCode = async (
    targetEmail: string,
    code: string
) => {
    if (!resend) {
        console.error('RESEND_API_KEY is missing. Email notification skipped.');
        return { success: false, error: 'Missing API Key' };
    }

    try {
        const sender = await getSenderEmail();

        const { data, error } = await resend.emails.send({
            from: sender,
            to: [targetEmail],
            subject: `[Dalbus] 비밀번호 초기화 인증번호 안내`,
            html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">비밀번호 초기화 인증번호</h2>
          <p>안녕하세요, Dalbus입니다.</p>
          <p>비밀번호를 초기화하기 위한 인증번호입니다. 아래 번호를 입력창에 입력해 주세요.</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <span style="font-size: 2rem; font-weight: bold; letter-spacing: 5px; color: #2563eb;">${code}</span>
          </div>

          <p>인증번호는 발송 후 10분 동안만 유효합니다.</p>
          <p>본인이 요청하지 않은 경우 이 메일을 무시해 주세요.</p>
          
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 0.8rem; color: #666;">
            본 메일은 발신전용입니다. 문의사항은 고객센터를 이용해 주세요.
          </p>
        </div>
      `,
        });

        if (error) {
            console.error('Password reset email sending failed:', error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Unexpected error sending password reset email:', error);
        return { success: false, error };
    }
};
