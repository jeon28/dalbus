import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizePhone, normalizeBirthDate } from '@/lib/utils';

export async function POST(request: Request) {
    try {
        const { email, password, name, phone, birthdate } = await request.json();

        // 결제완료 페이지의 "원클릭 회원전환"은 주문 정보(이메일/이름/전화)를 재사용하므로
        // 이메일·비밀번호만 필수로 받고, 나머지는 선택값으로 처리한다. (전화/생일은 마이페이지에서 보완 가능)
        if (!email || !password) {
            return NextResponse.json({ error: '이메일과 비밀번호를 입력해주세요.' }, { status: 400 });
        }

        const normalizedEmail = email.toLowerCase();

        // Normalize data (선택값은 비어 있을 수 있음)
        const normalizedPhone = phone ? normalizePhone(phone) : '';
        const normalizedBirthDate = birthdate ? normalizeBirthDate(birthdate) : '';

        // 1. Create user in auth.users
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            password,
            email_confirm: true,
            user_metadata: {
                name,
                phone: normalizedPhone,
                birthdate: normalizedBirthDate
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
