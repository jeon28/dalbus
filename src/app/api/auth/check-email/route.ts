import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json(
                { available: false, message: '이메일을 입력해주세요.' },
                { status: 400 }
            );
        }

        const normalizedEmail = email.toLowerCase();

        // Check email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return NextResponse.json(
                { available: false, message: '올바른 이메일 형식이 아닙니다.' },
                { status: 400 }
            );
        }

        // hifitidal.com 도메인은 내부 계정용이므로 가입 불가
        if (normalizedEmail.endsWith('@hifitidal.com')) {
            return NextResponse.json(
                { available: false, message: '가입할 수 없는 메일입니다.' }
            );
        }

        // Check if email exists in profiles table
        // Use select and potentially multiple rows to handle cases where duplicates might already exist
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
                message: '이미 사용 중인 이메일입니다.'
            });
        }

        return NextResponse.json({
            available: true,
            message: '사용 가능한 이메일입니다.'
        });

    } catch (error) {
        console.error('Email check error:', error);
        return NextResponse.json(
            { available: false, message: '서버 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
