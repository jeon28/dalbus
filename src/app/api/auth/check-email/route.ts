import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { validateEmail } from '@/lib/emailValidation';

// dns 모듈 사용 — Edge 런타임에서는 동작하지 않으므로 Node.js 런타임 강제
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json(
                { available: false, message: '이메일을 입력해주세요.' },
                { status: 400 }
            );
        }

        const normalizedEmail = email.trim().toLowerCase();

        // 형식 검사 + 차단 도메인 + 화이트리스트(즉시 통과) + DNS MX 점검
        const validation = await validateEmail(normalizedEmail);
        if (!validation.valid) {
            const status = validation.reason === 'invalid_format' ? 400 : 200;
            return NextResponse.json(
                { available: false, message: validation.message, reason: validation.reason },
                { status }
            );
        }

        // 중복 가입 확인 (여러 행이 있을 수 있는 케이스 대비)
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('email')
            .eq('email', normalizedEmail);

        if (error) {
            console.error('Email check error:', error);
            return NextResponse.json(
                { available: false, message: '중복 확인 중 오류가 발생했습니다.' },
                { status: 500 }
            );
        }

        if (data && data.length > 0) {
            return NextResponse.json({
                available: false,
                message: '이미 사용 중인 이메일입니다.',
                reason: 'duplicate',
            });
        }

        return NextResponse.json({
            available: true,
            message: '사용 가능한 이메일입니다.',
            reason: validation.reason,
        });

    } catch (error) {
        console.error('Email check error:', error);
        return NextResponse.json(
            { available: false, message: '서버 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
