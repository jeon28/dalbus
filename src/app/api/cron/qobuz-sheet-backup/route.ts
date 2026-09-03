import { NextRequest, NextResponse } from 'next/server';
import { syncQobuzToSheet } from '@/lib/qobuzSheetSync';

export const dynamic = 'force-dynamic';

/**
 * QOBUZ DB → 구글 시트 야간 전체 스냅샷 (Vercel Cron).
 *
 * 쓰기 라우트의 after() 동기화가 놓친 변경(마이그레이션, 수동 SQL, 동기화 실패 등)을 메운다.
 * Vercel Cron 은 CRON_SECRET 이 설정돼 있으면 Authorization: Bearer <secret> 을 붙여 호출한다.
 */
export async function GET(req: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.get('Authorization') !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await syncQobuzToSheet();

    // 실패해도 200 으로 돌려준다. Vercel 이 재시도해봐야 같은 이유로 또 실패한다.
    // 상태는 응답 본문과 서버 로그로 확인한다.
    return NextResponse.json(result);
}
