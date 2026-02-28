import { NextRequest, NextResponse } from 'next/server';
import { sendExpiryNotification } from '@/lib/email';
import { getServerSession, isAdmin } from '@/lib/auth';

export async function POST(req: NextRequest) {
    try {
        // 세션 확인 및 관리자 권한 체크
        const session = await getServerSession(req);
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
        }

        const { recipients, messageTemplate } = await req.json();

        if (!recipients || !recipients.length) {
            return NextResponse.json({ error: 'No recipients provided' }, { status: 400 });
        }

        const results = [];
        for (const recipient of recipients) {
            const { email, buyerName, tidalId, endDate } = recipient;

            if (!email) {
                results.push({ email: 'unknown', success: false, error: 'Missing email' });
                continue;
            }

            const sendResult = await sendExpiryNotification(email, {
                buyerName,
                tidalId,
                endDate,
                message: messageTemplate
            });

            results.push({ email, ...sendResult });
        }

        const successCount = results.filter(r => r.success).length;
        const failures = results.filter(r => !r.success).map(r => ({
            email: r.email,
            error: typeof r.error === 'object' ? JSON.stringify(r.error) : String(r.error)
        }));

        return NextResponse.json({
            message: `성공: ${successCount}건, 실패: ${failures.length}건`,
            successCount,
            failCount: failures.length,
            failures
        });

    } catch (error: unknown) {
        console.error('Notification API Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
