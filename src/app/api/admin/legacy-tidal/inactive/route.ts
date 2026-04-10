import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const showDeleted = searchParams.get('showDeleted') === 'true';

        const orderBy = showDeleted ? 'updated_at' : 'assigned_at';

        const { data, error } = await supabaseAdmin
            .from('legacy_tidal_assignments')
            .select(`
                *,
                accounts:legacy_tidal_accounts ( id, login_id )
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
