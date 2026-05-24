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

        // 이메일 정규식 검증 + 소문자 정규화 (방어적 코딩)
        const EMAIL_REGEX = /^[\w.+\-]+@[\w.\-]+\.[A-Za-z]{2,}$/;
        const safeEmail = userEmail && EMAIL_REGEX.test(userEmail)
            ? userEmail.toLowerCase().trim()
            : null;

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
            .or(`user_id.eq.${user.id}${safeEmail ? `,buyer_email.eq.${safeEmail}` : ''}`)
            .order('created_at', { ascending: false });

        if (orderError) {
            console.error('[DEBUG] Order Fetch Error:', orderError);
            throw orderError;
        }

        // 3.2 Fetch Account Assignments
        const orderIds = orders?.map(o => o.id) || [];
        let assignments: Record<string, unknown>[] = [];
        
        if (orderIds.length > 0) {
            const { data, error: assignmentError } = await supabaseAdmin
                .from('tidal_assignments')
                .select('*, order_id, order_number, orders(order_number, product_id, products(name), product_plans(duration_months))')
                .not('is_deleted', 'is', true)
                .eq('is_active', true)
                .in('order_id', orderIds);

            if (assignmentError) {
                console.error('[DEBUG] Assignment Fetch Error:', assignmentError);
                throw assignmentError;
            }
            assignments = data || [];
        }

        // 3.3 legacy_tidal_assignments: order_id FK 없음 → buyer_email로 조회
        if (safeEmail) {
            const { data: legacyData, error: legacyError } = await supabaseAdmin
                .from('legacy_tidal_assignments')
                .select('*')
                .eq('buyer_email', safeEmail)
                .eq('is_active', true)
                .eq('is_deleted', false);

            if (legacyError) {
                console.error('[DEBUG] Legacy Assignment Fetch Error:', legacyError);
                throw legacyError;
            }
            assignments = [...assignments, ...(legacyData || [])];
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
