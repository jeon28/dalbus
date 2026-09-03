import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET: 비활성 / 삭제 내역 조회
export async function GET(req: NextRequest) {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    try {
        const { searchParams } = new URL(req.url);
        const showDeleted = searchParams.get('showDeleted') === 'true';

        const orderBy = showDeleted ? 'updated_at' : 'assigned_at';

        const { data, error } = await supabaseAdmin
            .from('qobuz_assignments')
            .select(`
                *,
                accounts:qobuz_accounts ( id, login_id, master_email, master_end_date )
            `)
            .eq('is_active', false)
            .eq('is_deleted', showDeleted)
            .order(orderBy, { ascending: false });

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
