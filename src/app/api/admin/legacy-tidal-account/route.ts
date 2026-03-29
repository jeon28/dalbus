import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET: Fetch all legacy_tidal_account records with account info
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(req);
        if (!session) {
            return NextResponse.json({ error: 'Session not found or invalid' }, { status: 401 });
        }
        if (!isAdmin(session)) {
            return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search')?.trim() || '';
        const isActiveFilter = searchParams.get('is_active'); // 'true' | 'false' | null
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '50');
        const offset = (page - 1) * pageSize;

        let query = supabaseAdmin
            .from('legacy_tidal_account')
            .select(`
                *,
                accounts (
                    id,
                    login_id,
                    login_pw,
                    payment_email,
                    payment_day,
                    memo
                )
            `, { count: 'exact' })
            .eq('is_deleted', false)
            .order('assigned_at', { ascending: false })
            .range(offset, offset + pageSize - 1);

        if (isActiveFilter !== null) {
            query = query.eq('is_active', isActiveFilter === 'true');
        }

        if (search) {
            query = query.or(
                `tidal_id.ilike.%${search}%,buyer_name.ilike.%${search}%,buyer_email.ilike.%${search}%,buyer_phone.ilike.%${search}%,order_number.ilike.%${search}%`
            );
        }

        const { data, error, count } = await query;

        if (error) throw error;

        return NextResponse.json({ data, total: count || 0, page, pageSize });
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
