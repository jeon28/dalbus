import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // 세션 확인 및 관리자 권한 체크
    const session = await getServerSession(req);
    if (!session || !isAdmin(session)) {
        return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status'); // 주문신청, 입금확인, 배정완료, 작업완료
    const orderType = searchParams.get('order_type'); // NEW, EXT
    const guestType = searchParams.get('guest_type'); // guest, member
    const search = searchParams.get('search'); // name, email, phone

    let query = supabaseAdmin
        .from('orders')
        .select(`
            *,
            profiles(name, email, phone),
            products(name),
            product_plans(duration_months),
            order_accounts(id, account_id, slot_number, tidal_id, accounts(login_id)),
            tidal_assignments(id, slot_number, tidal_id, is_active, is_deleted, tidal_accounts:account_id(login_id))
        `, { count: 'exact' });

    // Status filter logic
    if (status === '삭제됨') {
        query = query.eq('is_deleted', true);
    } else {
        // Always exclude soft-deleted orders unless explicitly requesting deleted view
        query = query.neq('is_deleted', true);

        if (status === '작업완료') {
            query = query.eq('assignment_status', 'completed');
        } else if (status === '배정완료') {
            query = query.eq('assignment_status', 'assigned');
        } else if (status === '입금확인') {
            query = query.eq('payment_status', 'paid').neq('assignment_status', 'assigned').neq('assignment_status', 'completed');
        } else if (status === '주문신청') {
            query = query.in('payment_status', ['pending', 'not_paid']);
        }
    }

    if (orderType) {
        query = query.eq('order_type', orderType);
    }

    if (guestType) {
        query = query.eq('is_guest', guestType === 'guest');
    }

    if (search) {
        // Search in buyer_name, buyer_email, buyer_phone OR profiles(name, email, phone)
        // Note: Complex OR across relations might be tricky in a single RPC-like query if not using raw SQL.
        // For simplicity and to match current behavior, we'll try basic OR on the main table fields.
        query = query.or(`buyer_name.ilike.%${search}%,buyer_email.ilike.%${search}%,buyer_phone.ilike.%${search}%`);
    }

    const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        data,
        pagination: {
            total: count,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit)
        }
    });
}

// DELETE: Bulk delete unpaid (pending) orders with no assignments
export async function DELETE(req: NextRequest) {
    const session = await getServerSession(req);
    if (!session || !isAdmin(session)) {
        return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    try {
        // Fetch all pending orders that have no tidal_assignments
        const { data: pendingOrders, error: fetchError } = await supabaseAdmin
            .from('orders')
            .select('id')
            .in('payment_status', ['pending', 'not_paid'])
            .neq('assignment_status', 'assigned')
            .neq('assignment_status', 'completed');

        if (fetchError) throw fetchError;
        if (!pendingOrders || pendingOrders.length === 0) {
            return NextResponse.json({ deleted: 0 });
        }

        const allIds = pendingOrders.map(o => o.id);

        // Exclude any that have tidal_assignments (safety check)
        const { data: assigned, error: assignError } = await supabaseAdmin
            .from('tidal_assignments')
            .select('order_id')
            .in('order_id', allIds)
            .not('is_deleted', 'is', true);

        if (assignError) throw assignError;

        const assignedOrderIds = new Set((assigned || []).map(a => a.order_id));
        const deletableIds = allIds.filter(id => !assignedOrderIds.has(id));

        if (deletableIds.length === 0) {
            return NextResponse.json({ deleted: 0 });
        }

        const { error: deleteError } = await supabaseAdmin
            .from('orders')
            .delete()
            .in('id', deletableIds);

        if (deleteError) throw deleteError;

        return NextResponse.json({ deleted: deletableIds.length });
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
