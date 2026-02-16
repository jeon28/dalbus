import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { name, phone } = await req.json();

        if (!name || !phone) {
            return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
        }

        // Find orders matching name and phone
        // We look for orders that are EITHER:
        // 1. assigned (currently active)
        // 2. completed (expired but record exists)
        // And NOT failed/cancelled/refunded (payment_status check)

        const { data: rawOrders, error } = await supabaseAdmin
            .from('orders')
            .select(`
                id,
                order_number,
                created_at,
                payment_status,
                products ( name ),
                product_plans ( duration_months ),
                order_accounts ( end_date )
            `)
            .eq('buyer_name', name)
            .eq('buyer_phone', phone)
            .neq('payment_status', 'failed')
            .neq('payment_status', 'cancelled')
            .neq('payment_status', 'refunded')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Order match error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Map to ensure end_date is at the top level for frontend compatibility
        interface RawOrder {
            id: string;
            order_number: string;
            created_at: string;
            payment_status: string;
            products: { name: string } | null;
            product_plans: { duration_months: number } | null;
            order_accounts: { end_date: string }[] | null;
        }

        const orders = (rawOrders as unknown as RawOrder[])?.map((o) => ({
            ...o,
            end_date: o.order_accounts?.[0]?.end_date || null
        }));

        return NextResponse.json({ orders });

    } catch (error) {
        console.error('Lookup failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
