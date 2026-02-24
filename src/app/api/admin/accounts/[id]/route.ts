import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();

        // Filter out fields that are not in the accounts table (e.g., relationship fields)
        const updatableFields = [
            'login_id',
            'login_pw',
            'payment_email',
            'payment_day',
            'status',
            'max_slots',
            'used_slots',
            'memo',
            'product_id'
        ];

        const updateData = Object.keys(body)
            .filter(key => updatableFields.includes(key))
            .reduce((obj, key) => {
                obj[key] = body[key];
                return obj;
            }, {} as Record<string, unknown>);

        const { data, error } = await supabaseAdmin
            .from('accounts')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // Check if there are any assigned slots (order_accounts)
        const { count, error: checkError } = await supabaseAdmin
            .from('order_accounts')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', id);

        if (checkError) throw checkError;

        if (count && count > 0) {
            return NextResponse.json(
                { error: '슬롯이 배정되어 있는 계정은 삭제할 수 없습니다. 먼저 배정을 해제해 주세요.' },
                { status: 400 }
            );
        }

        const { error } = await supabaseAdmin
            .from('accounts')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
