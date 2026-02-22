import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        // 1. Get Token from Authorization Header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];

        // 2. Verify User with Token
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        // 3. Fetch Data for the User
        // 3.1 Fetch Orders
        const { data: orders, error: orderError } = await supabaseAdmin
            .from('orders')
            .select(`
                id,
                order_number,
                amount,
                created_at,
                assignment_status,
                products(name),
                product_plans(duration_months)
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (orderError) throw orderError;

        // 3.2 Fetch Account Assignments
        const { data: assignments, error: assignmentError } = await supabaseAdmin
            .from('order_accounts')
            .select('*, orders(products(name))')
            .in('order_id', orders?.map(o => o.id) || []);

        if (assignmentError) throw assignmentError;

        return NextResponse.json({
            orders: orders || [],
            assignments: assignments || []
        });

    } catch (error) {
        console.error('MyPage API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
