import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const { email, password, name, phone, birthdate } = await request.json();

        if (!email || !password || !name || !phone || !birthdate) {
            return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
        }

        // 1. Create user in auth.users
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                name,
                phone,
                birthdate
            }
        });

        if (authError) {
            console.error('Auth User creation error:', authError);
            if (authError.message.includes('already registered')) {
                return NextResponse.json({ error: '이미 가입된 이메일입니다.' }, { status: 400 });
            }
            return NextResponse.json({ error: '회원가입 중 오류가 발생했습니다: ' + authError.message }, { status: 500 });
        }

        const newUser = authData.user;
        if (!newUser) {
            return NextResponse.json({ error: '사용자 생성에 실패했습니다.' }, { status: 500 });
        }

        // Note: profiles table and order linkage are handled by the trigger handle_new_user()
        // when createUser is called.

        return NextResponse.json({
            success: true,
            message: '회원가입이 완료되었습니다. 주문 내역이 계정에 연결되었습니다.',
            user: { id: newUser.id, email: newUser.email }
        });

    } catch (error) {
        console.error('Guest conversion error:', error);
        return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}
