import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    // SECURITY: 프로덕션에서는 이 API를 삭제하거나 비밀번호로 보호해야 합니다!

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

    return NextResponse.json({
        supabaseUrl: supabaseUrl,
        supabaseServiceRoleKeyExists: !!supabaseServiceRoleKey,
        supabaseServiceRoleKeyLength: supabaseServiceRoleKey.length,
        supabaseServiceRoleKeyFirst20: supabaseServiceRoleKey.substring(0, 20),
        supabaseServiceRoleKeyLast20: supabaseServiceRoleKey.substring(supabaseServiceRoleKey.length - 20),
        allEnvKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE')),
        nodeEnv: process.env.NODE_ENV,
    });
}
