import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, isAdmin } from '@/lib/auth';
import { derivePassword, isPasswordSecretConfigured, PASSWORD_SECRET_ENV } from '@/lib/password-derive';
import { isHifiTidalId } from '@/lib/password-utils';

export const dynamic = 'force-dynamic';

// GET /api/admin/password/derive?id=<tidalId>
// Tidal ID 기준 규칙 계산 비밀번호를 돌려준다. (DB 조회 없음)
export async function GET(req: NextRequest) {
    const session = await getServerSession(req);
    if (!session) return NextResponse.json({ error: 'Session not found or invalid' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Admin role required' }, { status: 403 });

    const id = (new URL(req.url).searchParams.get('id') || '').trim();
    if (!id) return NextResponse.json({ error: 'Tidal ID가 필요합니다.' }, { status: 400 });

    if (!isPasswordSecretConfigured()) {
        return NextResponse.json(
            { error: `비밀번호 계산 키(${PASSWORD_SECRET_ENV})가 서버에 설정되어 있지 않습니다.` },
            { status: 503 },
        );
    }

    const password = derivePassword(id);
    if (!password) return NextResponse.json({ error: '비밀번호를 계산할 수 없습니다.' }, { status: 400 });

    return NextResponse.json({
        id,
        password,
        rule: isHifiTidalId(id) ? 'hifitidal-6digit' : 'external-8mixed',
    });
}
