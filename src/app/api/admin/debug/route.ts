import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // 운영 환경에서는 진단 엔드포인트를 노출하지 않는다.
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const denied = await requireAdmin(req);
    if (denied) return denied;

    try {
        const { data, error } = await supabaseAdmin
            .from('accounts')
            .select(`
                *,
                order_accounts (*)
            `)
            .order('created_at', { ascending: false })
            .limit(2);

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
