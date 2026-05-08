import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// GET: Fetch single order details
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: orderId } = await params;

    try {
        const { data: order, error } = await supabaseAdmin
            .from('orders')
            .select(`
                *,
                profiles(name, email, phone),
                products(name),
                product_plans(duration_months),
                order_accounts(id, account_id, slot_number, tidal_id, accounts(login_id))
            `)
            .eq('id', orderId)
            .single();

        if (error) throw error;
        if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

        return NextResponse.json(order);
    } catch (error) {
        console.error('Error fetching order:', error);
        const err = error as { message: string };
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE: Soft-delete by default; hard delete with ?hard=true
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: orderId } = await params;
    const url = new URL(request.url);
    const hardDelete = url.searchParams.get('hard') === 'true';

    try {
        // Check for active assignments
        const [{ data: order }, { data: ta }] = await Promise.all([
            supabaseAdmin.from('orders').select('assignment_status').eq('id', orderId).single(),
            supabaseAdmin.from('tidal_assignments').select('id').eq('order_id', orderId).not('is_deleted', 'is', true).eq('is_active', true),
        ]);

        const hasActiveAssignment =
            (order?.assignment_status === 'assigned' || order?.assignment_status === 'completed') ||
            (ta && ta.length > 0);

        if (hasActiveAssignment) {
            return NextResponse.json(
                { error: '배정된 계정이 있는 주문은 삭제할 수 없습니다. 먼저 배정 취소를 해주세요.' },
                { status: 400 }
            );
        }

        if (hardDelete) {
            const { error } = await supabaseAdmin.from('orders').delete().eq('id', orderId);
            if (error) throw error;
        } else {
            const { error } = await supabaseAdmin.from('orders').update({ is_deleted: true }).eq('id', orderId);
            if (error) throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting order:', error);
        const err = error as { message: string };
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
