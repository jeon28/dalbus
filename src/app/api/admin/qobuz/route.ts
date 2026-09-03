import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { qobuzService } from '@/lib/qobuzService';
import { scheduleQobuzSheetSync } from '@/lib/qobuzSheetSync';

export const dynamic = 'force-dynamic';

// GET: Qobuz 대표계정 + 하부계정 전체 조회
export async function GET(req: NextRequest) {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    try {
        const { searchParams } = new URL(req.url);
        const showInactive = searchParams.get('showInactive') === 'true';
        const showDeleted = searchParams.get('showDeleted') === 'true';

        const data = await qobuzService.getAllAccounts({ showInactive, showDeleted });

        return NextResponse.json(data);
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST: 새 대표계정(그룹) 생성
export async function POST(req: NextRequest) {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    try {
        const body = await req.json();

        const normalizedBody = {
            ...body,
            // 그룹 ID는 항상 대문자로 저장한다 (QG01 형식)
            login_id: body.login_id ? String(body.login_id).toUpperCase().trim() : body.login_id,
            master_email: body.master_email ? String(body.master_email).toLowerCase().trim() : null,
            payment_email: body.payment_email ? String(body.payment_email).toLowerCase().trim() : null,
            master_end_date: body.master_end_date || null
        };

        const data = await qobuzService.createAccount(normalizedBody);

        scheduleQobuzSheetSync();
        return NextResponse.json(data);
    } catch (error) {
        const err = error as { code?: string; message: string };
        if (err.code === '23505') {
            return NextResponse.json({ error: '이미 사용 중인 그룹 ID입니다.' }, { status: 409 });
        }
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
