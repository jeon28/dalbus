import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function validateQuickToken(req: NextRequest) {
    const token = req.headers.get('X-Quick-Token');
    const quickPassword = process.env.ADMIN_QUICK_PASSWORD;
    return token && quickPassword && token === quickPassword;
}

export async function GET(req: NextRequest) {
    try {
        if (!validateQuickToken(req)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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

        // Populate master_id robustly from all assignments (regardless of active/deleted)
        const accountIds = Array.from(new Set(data.map(d => d.account_id).filter(Boolean)));
        
        if (accountIds.length > 0) {
            const { data: masters, error: masterError } = await supabaseAdmin
                .from('legacy_tidal_assignments')
                .select('account_id, tidal_id')
                .in('account_id', accountIds as string[])
                .eq('slot_number', 0);
                
            if (!masterError && masters) {
                const masterMap: Record<string, string> = {};
                masters.forEach(m => {
                    if (m.tidal_id && m.tidal_id !== '-') {
                        masterMap[m.account_id] = m.tidal_id;
                    }
                });
                
                data.forEach(d => {
                    if (d.account_id && masterMap[d.account_id]) {
                        d.master_id = masterMap[d.account_id];
                    }
                });
            }
        }

        return NextResponse.json(data);
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
