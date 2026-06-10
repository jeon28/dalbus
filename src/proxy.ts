import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, isAdmin } from '@/lib/auth';

/**
 * 모든 /api/admin/** 요청을 서버에서 일괄 인가 검사한다.
 * (Next 16: 기존 middleware 규칙을 대체하는 proxy 규칙)
 * - X-Quick-Token(관리자 비밀번호 게이트) 또는 admin role Supabase 세션만 통과.
 * - 개별 라우트의 인라인 가드는 방어 심화로 유지(이 proxy 가 1차 차단).
 *
 * 참고: getServerSession 은 X-Quick-Token 일치 시 DB 조회 없이 즉시 통과하므로
 *       비밀번호 게이트로 진입한 관리자는 추가 비용이 없다.
 */
export async function proxy(req: NextRequest) {
    const session = await getServerSession(req);
    if (!session || !isAdmin(session)) {
        return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }
    return NextResponse.next();
}

export const config = {
    matcher: ['/api/admin/:path*'],
};
