import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
    try {
        const { email, code } = await req.json();

        if (!email || !code) {
            return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
        }

        // 1. Check code in database
        const { data, error } = await supabaseAdmin
            .from('verification_codes')
            .select('*')
            .eq('email', email)
            .eq('code', code)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1);

        if (error || !data || data.length === 0) {
            return NextResponse.json({ error: 'INVALID_CODE', message: '인증번호가 일치하지 않거나 만료되었습니다.' }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: '인증이 완료되었습니다.' });

    } catch (error) {
        console.error('Password reset verify error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
