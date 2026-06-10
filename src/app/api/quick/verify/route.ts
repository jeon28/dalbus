import { NextRequest, NextResponse } from 'next/server';
import { getAdminLoginPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { password } = await req.json();
        const quickPassword = process.env.ADMIN_QUICK_PASSWORD;
        // 관리자 대시보드(설정 > admin_login_pw)에서 관리하는 비밀번호도 허용
        const dbPassword = await getAdminLoginPassword();

        if (!quickPassword && !dbPassword) {
            return NextResponse.json({ error: 'Quick access not configured' }, { status: 500 });
        }

        if (password && (password === quickPassword || password === dbPassword)) {
            return NextResponse.json({ success: true, token: password });
        }

        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    } catch {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
