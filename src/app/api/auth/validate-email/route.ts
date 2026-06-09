import { NextRequest, NextResponse } from 'next/server';
import { validateEmail } from '@/lib/emailValidation';

// validateEmail 이 dns 모듈을 사용 — Edge 런타임 회피
export const runtime = 'nodejs';

/**
 * 이메일 검증 전용 엔드포인트 (중복 가입 확인은 하지 않음).
 * 주문 등 회원가입이 아닌 흐름에서 "실제 수신 가능한 이메일"인지만 점검할 때 사용한다.
 */
export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json(
                { valid: false, message: '이메일을 입력해주세요.' },
                { status: 400 }
            );
        }

        const result = await validateEmail(email);
        const status = result.reason === 'invalid_format' ? 400 : 200;

        return NextResponse.json(
            { valid: result.valid, message: result.message, reason: result.reason },
            { status }
        );
    } catch (error) {
        console.error('Email validation error:', error);
        return NextResponse.json(
            { valid: false, message: '서버 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
