import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;

    try {
        const body = await req.json();
        const updates: any = {};

        if (body.payment_status) updates.payment_status = body.payment_status;
        if (body.assignment_status) updates.assignment_status = body.assignment_status;

        // Backward compatibility support if 'status' was used for assignment
        if (body.status && !body.assignment_status) updates.assignment_status = body.status;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No status provided' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('orders')
            .update(updates)
            .eq('id', params.id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
