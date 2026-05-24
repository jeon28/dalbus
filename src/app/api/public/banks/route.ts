import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * [폐기됨] 무인증 계좌 공개 API
 *
 * 이 엔드포인트는 보안상 폐기되었습니다.
 * 계좌 정보는 주문 생성 시 서버에서 1개를 자동 할당하며,
 * 결제 안내는 `/api/orders/[id]/payment-info` 로 주문 ID 기반으로 조회합니다.
 */
export async function GET() {
    return NextResponse.json(
        { error: 'This endpoint has been deprecated for security reasons.' },
        { status: 410 } // Gone
    );
}
