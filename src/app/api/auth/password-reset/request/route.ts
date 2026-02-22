import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPasswordResetCode } from '@/lib/email';

export async function POST(req: NextRequest) {
    try {
        const { email, name, phone } = await req.json();

        if (!email || !name || !phone) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Check if user exists in profiles and Name/Phone match
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', email)
            .eq('name', name)
            .eq('phone', phone)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: 'USER_NOT_FOUND', message: '입력하신 정보와 일치하는 회원을 찾을 수 없습니다.' }, { status: 404 });
        }

        // 2. Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes from now

        // 3. Save to verification_codes
        const { error: codeError } = await supabaseAdmin
            .from('verification_codes')
            .insert({
                email,
                code,
                expires_at: expiresAt
            });

        if (codeError) throw codeError;

        // 4. Send Email
        const { success, error: emailError } = await sendPasswordResetCode(email, code);

        if (!success) {
            console.error('Failed to send password reset email:', emailError);
            return NextResponse.json({ error: 'EMAIL_SEND_FAILED', message: '이메일 발송에 실패했습니다.' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: '인증번호가 발송되었습니다.' });

    } catch (error) {
        console.error('Password reset request error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
