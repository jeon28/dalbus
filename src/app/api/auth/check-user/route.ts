import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ exists: false }, { status: 400 });
        }

        // Check if email exists in profiles table using service role (bypasses RLS)
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('email')
            .eq('email', email)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Check user error:', error);
            return NextResponse.json({ exists: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ exists: !!data });

    } catch (error) {
        console.error('Check user error:', error);
        return NextResponse.json({ exists: false }, { status: 500 });
    }
}
