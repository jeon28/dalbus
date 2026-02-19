import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { error: '이메일과 비밀번호를 입력해주세요.' },
                { status: 400 }
            );
        }

        // 1. Check if user exists (using admin client to bypass RLS/Auth)
        const { data: userCheck, error: userCheckError } = await supabaseAdmin
            .from('profiles')
            .select('id, role')
            .eq('email', email)
            .single();

        if (userCheckError || !userCheck) {
            // User not found in profiles
            return NextResponse.json(
                { error: 'USER_NOT_FOUND', message: '가입되지 않은 이메일입니다.' },
                { status: 404 }
            );
        }

        // 2. User exists, proceed with password auth
        // Create a fresh client for this request to ensure no session leakage
        // using the ANON key because we are authenticating a user
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: false, // We just want to get the token, not persist on server fs
            }
        });

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error('Login API Auth Error:', error.message);
            // Distinguish between invalid credentials and other errors if possible
            if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_grant')) {
                return NextResponse.json({ error: 'INVALID_PASSWORD', message: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
            }
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        return NextResponse.json({
            user: data.user,
            session: data.session,
            role: userCheck.role // Return role to avoid extra client fetch if possible (though client might verify again)
        });

    } catch (error) {
        console.error('Login API Server Error:', error instanceof Error ? error.message : error);
        return NextResponse.json(
            { error: 'SERVER_ERROR', message: '서버 내부 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
