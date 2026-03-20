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
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const sort = searchParams.get('sort') || 'created_at';
    const direction = searchParams.get('direction') === 'asc';

    const offset = (page - 1) * limit;
    const now = new Date().toISOString();

    // 1. Fetching profiles with role 'user' (paginated)
    let query = supabaseAdmin
        .from('profiles')
        .select('id, name, email, phone, birth_date, created_at, memo', { count: 'exact' })
        .eq('role', 'user');

    if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    // Filter by status if requested
    if (status === 'active' || status === 'inactive') {
        const { data: activeProfilesRows } = await supabaseAdmin
            .from('orders')
            .select(`
                user_id,
                buyer_email,
                order_accounts!inner(id)
            `)
            .gt('order_accounts.end_date', now);

        const activeUserIds = new Set(activeProfilesRows?.map(r => r.user_id).filter(Boolean));
        const activeEmails = new Set(activeProfilesRows?.map(r => r.buyer_email).filter(Boolean));

        if (status === 'active') {
            if (activeUserIds.size > 0 || activeEmails.size > 0) {
                query = query.or(`id.in.(${Array.from(activeUserIds).map(id => `"${id}"`).join(',')}),email.in.(${Array.from(activeEmails).map(email => `"${email}"`).join(',')})`);
            } else {
                // No active users found, force empty result
                query = query.eq('id', '00000000-0000-0000-0000-000000000000');
            }
        } else if (status === 'inactive') {
            if (activeUserIds.size > 0) {
                query = query.not('id', 'in', `(${Array.from(activeUserIds).map(id => `"${id}"`).join(',')})`);
            }
            if (activeEmails.size > 0) {
                query = query.not('email', 'in', `(${Array.from(activeEmails).map(email => `"${email}"`).join(',')})`);
            }
        }
    }

    const sortColumn = sort === 'joined' ? 'created_at' : sort;

    const { data: profiles, error: profileError, count } = await query
        .order(sortColumn, { ascending: direction })
        .range(offset, offset + limit - 1);

    if (profileError) {
        console.error('Member profile fetch error:', profileError);
        return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
        return NextResponse.json({
            data: [],
            pagination: {
                total: count || 0,
                page,
                limit,
                totalPages: Math.ceil((count || 0) / limit)
            }
        });
    }

    // 2. Fetch all orders and order_accounts to calculate active status for the fetched profiles
    // For simplicity with existing logic, we still fetch all but we could optimize further
    // const now = new Date().toISOString(); // Already defined at the top

    const { data: orders, error: ordersError } = await supabaseAdmin
        .from('orders')
        .select('id, user_id, buyer_email');

    if (ordersError) {
        return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    const { data: activeAccounts, error: accountsError } = await supabaseAdmin
        .from('order_accounts')
        .select('order_id')
        .gt('end_date', now);

    if (accountsError) {
        return NextResponse.json({ error: accountsError.message }, { status: 500 });
    }

    const activeOrderIds = new Set(activeAccounts.map(aa => aa.order_id));

    const dataWithStatus = profiles.map(profile => {
        const userOrders = orders.filter(o =>
            o.user_id === profile.id || o.buyer_email === profile.email
        );
        const orderIds = userOrders.map(o => o.id);
        const isActive = orderIds.some(id => activeOrderIds.has(id));

        return {
            ...profile,
            is_active: isActive
        };
    });

    return NextResponse.json({
        data: dataWithStatus,
        pagination: {
            total: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit)
        }
    });
}

export async function PATCH(request: NextRequest) {
    try {
        // 세션 확인 및 관리자 권한 체크
        const session = await getServerSession(request);
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
        }

        const body = await request.json();
        const { id, memo } = body;

        if (!id) {
            return NextResponse.json({ error: '사용자 ID가 필요합니다.' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ memo })
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: '메모가 업데이트되었습니다.' });
    } catch (error) {
        console.error('Update member memo error:', error);
        return NextResponse.json({ error: '메모 업데이트 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        // 세션 확인 및 관리자 권한 체크
        const session = await getServerSession(request);
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('id');

        if (!userId) {
            return NextResponse.json({ error: '사용자 ID가 필요합니다.' }, { status: 400 });
        }

        // 1. Check if user has any orders
        const { data: orders, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('id')
            .eq('user_id', userId);

        if (orderError) {
            return NextResponse.json({ error: orderError.message }, { status: 500 });
        }

        if (orders && orders.length > 0) {
            return NextResponse.json({
                error: '주문 내역이 있는 회원은 삭제할 수 없습니다.'
            }, { status: 400 });
        }

        // 2. Delete from profiles (will cascade delete from auth.users due to FK)
        const { error: deleteError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (deleteError) {
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        // 3. Also delete from auth.users
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authDeleteError) {
            console.error('Auth delete error:', authDeleteError);
            // Continue even if auth delete fails, as profile is already deleted
        }

        return NextResponse.json({ success: true, message: '회원이 삭제되었습니다.' });

    } catch (error) {
        console.error('Delete member error:', error);
        return NextResponse.json({ error: '회원 삭제 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
