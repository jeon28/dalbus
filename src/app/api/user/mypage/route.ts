import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        // 1. 세션 확인
        const session = await getServerSession(req);
        if (!session) {
            console.warn('[DEBUG] MyPage API: No session found');
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        const user = session;
        const userEmail = user.email;
        console.log(`[DEBUG] MyPage API Request - UserID: ${user.id}, Email: ${userEmail}`);

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

        if (orderError) {
            console.error('[DEBUG] Order Fetch Error:', orderError);
            throw orderError;
        }

        // 3.2 Fetch Account Assignments
        const orderIds = orders?.map(o => o.id) || [];
        let assignments: Record<string, unknown>[] = [];
        
        // Only fetch if we have something to match against
        if (orderIds.length > 0 || userEmail) {
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
            }

            const { data, error: assignmentError } = await assignmentsQuery;
            if (assignmentError) {
                console.error('[DEBUG] Assignment Fetch Error:', assignmentError);
                throw assignmentError;
            }
            assignments = data || [];
        }

        console.log(`[DEBUG] MyPage API Success - Found ${orders?.length || 0} orders and ${assignments.length} assignments`);

        return NextResponse.json({
            orders: orders || [],
            assignments: assignments || []
        });

    } catch (error) {
        console.error('MyPage API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
