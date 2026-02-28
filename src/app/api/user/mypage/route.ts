import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        // 1. 세션 확인
        const session = await getServerSession(req);
        if (!session) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        const user = session;

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
            .select('*, orders(products(name), product_plans(duration_months))')
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
