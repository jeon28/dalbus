import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * 관리자용: 특정 회원이 마이페이지에서 보는 데이터를 그대로 반환한다.
 * (회원용 /api/user/mypage 와 동일한 조회 로직 + 프로필)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const { id: userId } = await params;

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        // 1. 프로필
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, name, email, phone, birth_date, signup_method, created_at')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: '회원 정보를 찾을 수 없습니다.' }, { status: 404 });
        }

        const EMAIL_REGEX = /^[\w.+\-]+@[\w.\-]+\.[A-Za-z]{2,}$/;
        const safeEmail = profile.email && EMAIL_REGEX.test(profile.email)
            ? profile.email.toLowerCase().trim()
            : null;

        // 2. 주문 (user_id 또는 buyer_email, 삭제 제외) — 마이페이지와 동일
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
            .or(`user_id.eq.${userId}${safeEmail ? `,buyer_email.eq.${safeEmail}` : ''}`)
            .not('is_deleted', 'is', true)
            .order('created_at', { ascending: false });

        if (orderError) throw orderError;

        // 3. 배정 (활성, 삭제 제외, 주문에 연결된 것) — 마이페이지와 동일
        const orderIds = orders?.map(o => o.id) || [];
        let assignments: Record<string, unknown>[] = [];
        if (orderIds.length > 0) {
            const { data, error: assignmentError } = await supabaseAdmin
                .from('tidal_assignments')
                .select('*, order_id, order_number, orders(order_number, product_id, products(name), product_plans(duration_months))')
                .not('is_deleted', 'is', true)
                .eq('is_active', true)
                .in('order_id', orderIds);
            if (assignmentError) throw assignmentError;
            assignments = data || [];
        }

        return NextResponse.json({
            profile,
            orders: orders || [],
            assignments: assignments || []
        });
    } catch (error) {
        console.error('Admin member mypage preview error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * 주문번호로 특정 주문을 이 회원에 강제 연동한다.
 * 연동 = 해당 orders 행의 user_id 를 회원으로 설정 → 마이페이지에 주문/구독이 표시됨.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: userId } = await params;

    try {
        const body = await request.json();
        const orderNumber = (body.orderNumber || '').toString().trim().replace(/^DAL-/i, '');
        if (!orderNumber) {
            return NextResponse.json({ error: '주문번호를 입력해주세요.' }, { status: 400 });
        }

        // 회원 확인
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, name, email')
            .eq('id', userId)
            .single();
        if (profileError || !profile) {
            return NextResponse.json({ error: '회원 정보를 찾을 수 없습니다.' }, { status: 404 });
        }

        // 주문번호로 주문 찾기 (DAL- 접두사 유무 모두 허용)
        const { data: orders, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('id, order_number, user_id, buyer_name')
            .or(`order_number.eq.${orderNumber},order_number.eq.DAL-${orderNumber}`)
            .not('is_deleted', 'is', true)
            .limit(1);
        if (orderError) {
            return NextResponse.json({ error: orderError.message }, { status: 500 });
        }
        const order = orders?.[0];
        if (!order) {
            return NextResponse.json({ error: `주문번호 '${orderNumber}' 주문을 찾을 수 없습니다.` }, { status: 404 });
        }

        // 회원으로 연동 (user_id 설정)
        const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update({ user_id: userId })
            .eq('id', order.id);
        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `주문번호 ${order.order_number}을(를) ${profile.name || profile.email} 회원에게 연동했습니다.`
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Server error';
        console.error('Member order link error:', error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
