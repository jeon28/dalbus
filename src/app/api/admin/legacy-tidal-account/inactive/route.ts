import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('legacy_tidal_account')
            .select(`
                *,
                accounts ( login_id )
            `)
            .eq('is_active', false)
            .eq('is_deleted', false)
            .order('assigned_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
