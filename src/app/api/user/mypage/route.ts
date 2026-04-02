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
        const userEmail = user.email;

        // 3. Fetch Data for the User
        // 3.1 Fetch Orders (by user_id OR buyer_email)
        const { data: orders, error: orderError } = await supabaseAdmin
            .from('orders')
            .select(`
                id,
                order_number,
                amount,
                created_at,
                assignment_status,
                product_id,
                buyer_email,
                products(name),
                product_plans(duration_months)
            `)
            .or(`user_id.eq.${user.id}${userEmail ? `,buyer_email.eq.${userEmail}` : ''}`)
            .order('created_at', { ascending: false });

        if (orderError) throw orderError;

        // 3.2 Fetch Account Assignments
        // Fetch assignments linked to these orders OR matching the buyer email directly
        const orderIds = orders?.map(o => o.id) || [];
        
        let assignmentsQuery = supabaseAdmin
            .from('order_accounts')
            .select('*, order_id, orders(product_id, products(name), product_plans(duration_months))')
            .eq('is_deleted', false);

        if (orderIds.length > 0 && userEmail) {
            assignmentsQuery = assignmentsQuery.or(`order_id.in.(${orderIds.join(',')}),buyer_email.eq.${userEmail}`);
        } else if (orderIds.length > 0) {
            assignmentsQuery = assignmentsQuery.in('order_id', orderIds);
        } else if (userEmail) {
            assignmentsQuery = assignmentsQuery.eq('buyer_email', userEmail);
        } else {
            // No orders and no email, return empty
            return NextResponse.json({ orders: [], assignments: [] });
        }

        const { data: assignments, error: assignmentError } = await assignmentsQuery;

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
