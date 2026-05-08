import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const body = await req.json();
        const { duration_months, price, discount_rate, is_active } = body;

        const { data, error } = await supabaseAdmin
            .from('product_plans')
            .update({
                duration_months,
                price,
                discount_rate,
                is_active
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating plan:', error);
            if (error.code === '23505') {
                return NextResponse.json({ error: '이미 동일한 개월 수의 활성 요금제가 존재합니다.' }, { status: 400 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Block deletion if active (non-soft-deleted) orders reference this plan
    const { data: activeOrders } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('plan_id', id)
        .neq('is_deleted', true)
        .limit(1);

    if (activeOrders && activeOrders.length > 0) {
        return NextResponse.json(
            { error: '주문이 존재하는 요금제는 삭제할 수 없습니다. 주문내역에서 먼저 삭제 후 시도하세요.' },
            { status: 400 }
        );
    }

    // DB FK is ON DELETE SET NULL — soft-deleted orders referencing this plan
    // will have plan_id automatically nullified by the database on delete.
    const { error } = await supabaseAdmin
        .from('product_plans')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
