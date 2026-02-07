import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const { password } = await req.json();

        const { data, error } = await supabaseAdmin
            .from('qna')
            .select('guest_password')
            .eq('id', id)
            .single();

        if (error || !data) {
            return NextResponse.json({ success: false }, { status: 404 });
        }

        if (data.guest_password === password) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ success: false, message: 'Password incorrect' }, { status: 401 });
        }
    } catch (e) {
        return NextResponse.json({ error: 'Check failed' }, { status: 500 });
    }
}
