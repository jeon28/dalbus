import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: orderId } = await params;

    try {
        // 1. Check if the order has any assignments
        const { data: assignments, error: assignError } = await supabaseAdmin
            .from('order_accounts')
            .select('id')
            .eq('order_id', orderId);

        if (assignError) throw assignError;

        if (assignments && assignments.length > 0) {
            return NextResponse.json(
                { error: '배정된 계정이 있는 주문은 삭제할 수 없습니다. 먼저 배정 취소를 해주세요.' },
                { status: 400 }
            );
        }

        // 2. Delete the order
        const { error: deleteError } = await supabaseAdmin
            .from('orders')
            .delete()
            .eq('id', orderId);

        if (deleteError) throw deleteError;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting order:', error);
        const err = error as { message: string };
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
