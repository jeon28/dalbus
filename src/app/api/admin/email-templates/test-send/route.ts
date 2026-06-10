import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { requireAdmin } from '@/lib/auth';

export async function POST(request: NextRequest) {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    try {
        const body = await request.json();
        const { target_email, subject, content } = body;

        if (!target_email || !subject || !content) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 테스트용 데이터 (치환자 적용 확인용)
        const sampleData: Record<string, string> = {
            buyer_name: '홍길동(테스트)',
            order_id: 'TEST-12345',
            product_name: '테스트 상품',
            plan_name: '프리미엄 1개월',
            amount: '12,000',
            depositor_name: '홍길동',
            tidal_id: 'test_user@example.com',
            tidal_pw: 'test_password!',
            end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
            message: '이것은 테스트 메시지입니다.\n여러 줄로 구성될 수 있습니다.'
        };

        // 치환자 적용
        let finalHtml = content;
        let finalSubject = subject;
        
        Object.keys(sampleData).forEach(key => {
            const regex = new RegExp(`{${key}}`, 'g');
            finalHtml = finalHtml.replace(regex, sampleData[key]);
            finalSubject = finalSubject.replace(regex, sampleData[key]);
        });

        const result = await sendEmail({
            recipient_email: target_email,
            recipient_name: '테스트 수신자',
            subject: finalSubject,
            html: finalHtml,
            mailType: '테스트 발송'
        });

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error sending test email:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
