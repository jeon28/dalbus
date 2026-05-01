import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { password } = await req.json();
        const quickPassword = process.env.ADMIN_QUICK_PASSWORD;

        if (!quickPassword) {
            return NextResponse.json({ error: 'Quick access not configured' }, { status: 500 });
        }

        if (password === quickPassword) {
            return NextResponse.json({ success: true, token: quickPassword });
        }

        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    } catch {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
