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

        const { data: orders, error } = await supabaseAdmin
            .from('orders')
            .select('id, order_number, buyer_name, buyer_phone, buyer_email, order_accounts ( tidal_id, end_date )')
            .eq('user_id', session.id)
            .eq('product_id', productId)
            .neq('payment_status', 'failed')
            .neq('payment_status', 'cancelled')
            .neq('payment_status', 'refunded')
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        interface OrderWithAccounts {
            id: string;
            order_number: string;
            buyer_name: string | null;
            buyer_phone: string | null;
            buyer_email: string | null;
            order_accounts: { tidal_id: string | null; end_date: string | null }[] | null;
        }

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

        for (const order of ((orders || []) as unknown as OrderWithAccounts[])) {
            for (const acc of (order.order_accounts || [])) {
                if (acc.tidal_id && !seen.has(acc.tidal_id)) {
                    seen.add(acc.tidal_id);
                    accounts.push({
                        orderId: order.id,
                        orderNumber: order.order_number,
                        tidalId: acc.tidal_id,
                        endDate: acc.end_date,
                        buyerName: order.buyer_name,
                        buyerPhone: order.buyer_phone,
                        buyerEmail: order.buyer_email,
                    });
                }
            }
        }

        return NextResponse.json({ accounts });

    } catch (error) {
        console.error('Tidal accounts fetch error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
