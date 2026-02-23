import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: userId } = await params;

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        // 1. Get member profile to have the email for fallback
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('email')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            console.error('Profile not found:', userId);
            return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
        }

        // 2. Find all orders belonging to this user (by ID or Email)
        const { data: orders, error: ordersError } = await supabaseAdmin
            .from('orders')
            .select(`
                id,
                order_number,
                products ( name ),
                product_plans ( duration_months )
            `)
            .or(`user_id.eq.${userId},buyer_email.eq.${profile.email}`);

        if (ordersError) {
            console.error('Error fetching orders:', ordersError);
            return NextResponse.json({ error: ordersError.message }, { status: 500 });
        }

        if (!orders || orders.length === 0) {
            return NextResponse.json([]);
        }

        const orderIds = orders.map(o => o.id);
        const orderNumbers = orders.map(o => o.order_number).filter(Boolean);

        // 3. Find order_accounts linked to these orders
        // Use .or to match either by order_id or order_number (fallback for imports)
        const query = supabaseAdmin
            .from('order_accounts')
            .select('*')
            .or(`order_id.in.(${orderIds.join(',')}),order_number.in.(${orderNumbers.join(',')})`);

        const { data: accounts, error: accountsError } = await query.order('assigned_at', { ascending: false });

        if (accountsError) {
            console.error('Error fetching order accounts:', accountsError);
            return NextResponse.json({ error: accountsError.message }, { status: 500 });
        }

        // 4. Transform data to include product/plan info from the orders list
        const enrichedAccounts = accounts.map(account => {
            const relatedOrder = orders.find(o => o.id === account.order_id || (account.order_number && o.order_number === account.order_number));
            return {
                ...account,
                orders: relatedOrder || null
            };
        });

        return NextResponse.json(enrichedAccounts);
    } catch (error) {
        console.error('Server error fetching member accounts:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
