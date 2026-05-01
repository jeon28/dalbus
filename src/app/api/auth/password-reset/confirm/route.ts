import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    try {
        const { email, code, newPassword } = await req.json();

        if (!email || !code || !newPassword) {
            return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
        }

        // 1. Re-verify code (safety check)
        const { data: codeData, error: codeError } = await supabaseAdmin
            .from('verification_codes')
            .select('*')
            .eq('email', email)
            .eq('code', code)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1);

        if (codeError || !codeData || codeData.length === 0) {
            return NextResponse.json({ error: 'INVALID_CODE', message: '인증이 만료되었습니다. 다시 시도해주세요.' }, { status: 400 });
        }

        // 2. [IMPORTANT] Reliable Same-Password Check
        // Try to sign in with the NEW password. If it succeeds, it means it's the SAME as current.
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password: newPassword,
        });

        if (!signInError && signInData.session) {
            // New password is the same as the old one!
            return NextResponse.json({
                error: 'SAME_PASSWORD',
                message: '기존 비밀번호와 다른 새 비밀번호를 입력해 주세요.'
            }, { status: 400 });
        }

        // 3. Get User ID from profile
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
        }

        // 4. Update Password in Supabase Auth
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            profile.id,
            { password: newPassword }
        );

        if (updateError) {
            console.error('Password update error (Auth):', updateError);
            return NextResponse.json({ error: 'UPDATE_FAILED', message: '비밀번호 업데이트에 실패했습니다.' }, { status: 500 });
        }

        // 4. Delete used code (optional but recommended)
        await supabaseAdmin
            .from('verification_codes')
            .delete()
            .eq('email', email);

        return NextResponse.json({ success: true, message: '비밀번호가 성공적으로 변경되었습니다.' });

    } catch (error) {
        console.error('Password reset confirm error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
