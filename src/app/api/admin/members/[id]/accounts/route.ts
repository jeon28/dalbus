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
        // Fetch order_accounts linked to orders placed by this user
        // We join 'orders' to filter by user_id
        // We also want the Product Name, which is on the 'orders' -> 'products' table
        const { data, error } = await supabaseAdmin
            .from('order_accounts')
            .select(`
                *,
                orders!inner (
                    user_id,
                    products (
                        name
                    ),
                    product_plans (
                        duration_months
                    )
                )
            `)
            .eq('orders.user_id', userId)
            // order_accounts doesn't have created_at, using assigned_at or just order by id desc
            .order('assigned_at', { ascending: false });

        if (error) {
            console.error('Error fetching member accounts:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Server error fetching member accounts:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
