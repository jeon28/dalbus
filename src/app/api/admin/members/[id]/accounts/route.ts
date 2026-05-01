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

        // 3. Find assignments from unified table
        const { data: assignments, error: assignmentsError } = await supabaseAdmin
            .from('tidal_assignments')
            .select('*, accounts:tidal_accounts ( login_id )')
            .eq('is_deleted', false)
            .or(`order_id.in.(${orderIds.join(',')})${orderNumbers.length > 0 ? `,order_number.in.(${orderNumbers.join(',')})` : ''}${profile.email ? `,buyer_email.eq.${profile.email}` : ''}`)
            .order('assigned_at', { ascending: false });

        if (assignmentsError) {
            console.error('Error fetching assignments:', assignmentsError);
            return NextResponse.json({ error: assignmentsError.message }, { status: 500 });
        }

        const allAccounts = assignments || [];

        // 4. Transform data to include product/plan info
        const enrichedAccounts = allAccounts.map(account => {
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
