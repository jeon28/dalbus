import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(req);
        if (!session) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        const productId = req.nextUrl.searchParams.get('productId');
        if (!productId) {
            return NextResponse.json({ error: 'productId is required' }, { status: 400 });
        }

        // Get user's orders for this product first
        const { data: orders, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('id, order_number, buyer_name, buyer_phone, buyer_email')
            .eq('user_id', session.id)
            .eq('product_id', productId)
            .neq('payment_status', 'failed')
            .neq('payment_status', 'cancelled')
            .neq('payment_status', 'refunded')
            .order('created_at', { ascending: false });

        if (orderError) {
            return NextResponse.json({ error: orderError.message }, { status: 500 });
        }

        const orderIds = (orders || []).map(o => o.id);

        if (orderIds.length === 0) {
            return NextResponse.json({ accounts: [] });
        }

        // Read actual assignments from tidal_assignments table
        const { data: assignments, error } = await supabaseAdmin
            .from('tidal_assignments')
            .select('order_id, tidal_id, end_date')
            .not('is_deleted', 'is', true)
            .eq('is_active', true)
            .in('order_id', orderIds);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const orderMap = new Map((orders || []).map(o => [o.id, o]));

        const seen = new Set<string>();
        const accounts: {
            orderId: string;
            orderNumber: string;
            tidalId: string;
            endDate: string | null;
            buyerName: string | null;
            buyerPhone: string | null;
            buyerEmail: string | null;
        }[] = [];

        for (const acc of (assignments || [])) {
            if (acc.tidal_id && !seen.has(acc.tidal_id)) {
                seen.add(acc.tidal_id);
                const order = orderMap.get(acc.order_id);
                accounts.push({
                    orderId: acc.order_id,
                    orderNumber: order?.order_number || '',
                    tidalId: acc.tidal_id,
                    endDate: acc.end_date,
                    buyerName: order?.buyer_name || null,
                    buyerPhone: order?.buyer_phone || null,
                    buyerEmail: order?.buyer_email || null,
                });
            }
        }

        return NextResponse.json({ accounts });

    } catch (error) {
        console.error('Tidal accounts fetch error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
