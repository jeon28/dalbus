import { NextResponse } from 'next/server';

export async function GET() {
    // 환경변수 설정 여부를 노출하므로 운영 환경에서는 차단한다.
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'not set',
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'set' : 'not set',
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'not set',
    });
}
