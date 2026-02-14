import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// PUT: Update assignment and linked order details
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params; // order_accounts.id
        const body = await req.json();

        // body contains: tidal_password, buyer_name, buyer_phone, buyer_email, start_date, end_date, type
        const {
            tidal_password,
            buyer_name,
            buyer_phone,
            buyer_email,
            start_date,
            end_date,
            type,
            order_id // Needed to update order dates if present
        } = body;

        // 1. Update order_accounts (all editable fields including buyer info)
        const oaUpdates: Record<string, string | null> = {};
        if (tidal_password !== undefined) oaUpdates.tidal_password = tidal_password;
        if (body.tidal_id !== undefined) oaUpdates.tidal_id = body.tidal_id;
        if (type !== undefined) oaUpdates.type = type;
        if (buyer_name !== undefined) oaUpdates.buyer_name = buyer_name;
        if (buyer_phone !== undefined) oaUpdates.buyer_phone = buyer_phone;
        if (buyer_email !== undefined) oaUpdates.buyer_email = buyer_email;

        if (Object.keys(oaUpdates).length > 0) {
            const { error: oaError } = await supabaseAdmin
                .from('order_accounts')
                .update(oaUpdates)
                .eq('id', id);
            if (oaError) throw oaError;
        }

        // 2. Update orders table (only dates if provided)
        // Buyer info is now stored in order_accounts, not orders
        let targetOrderId = order_id;

        if (!targetOrderId) {
            const { data: oa } = await supabaseAdmin.from('order_accounts').select('order_id').eq('id', id).single();
            targetOrderId = oa?.order_id;
        }

        if (targetOrderId) {
            const orderUpdates: Record<string, string | number | null> = {};
            if (start_date !== undefined) orderUpdates.start_date = start_date;
            if (end_date !== undefined) orderUpdates.end_date = end_date;

            if (Object.keys(orderUpdates).length > 0) {
                const { error: ordError } = await supabaseAdmin
                    .from('orders')
                    .update(orderUpdates)
                    .eq('id', targetOrderId);
                if (ordError) throw ordError;
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE: Unassign (Remove from order_accounts)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params; // order_accounts.id

        // 1. Get info to decrement used_slots
        const { data: assignment, error: fetchError } = await supabaseAdmin
            .from('order_accounts')
            .select('account_id, order_id')
            .eq('id', id)
            .single();

        if (fetchError || !assignment) throw new Error('Assignment not found');

        // 2. Delete assignment
        const { error: delError } = await supabaseAdmin
            .from('order_accounts')
            .delete()
            .eq('id', id);

        if (delError) throw delError;

        // 3. Update Account Used Slots (Robust Sync)
        const { count: actualCount } = await supabaseAdmin
            .from('order_accounts')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', assignment.account_id);

        await supabaseAdmin
            .from('accounts')
            .update({ used_slots: actualCount || 0 })
            .eq('id', assignment.account_id);

        // 4. Update Order Status back to 'waiting'? 
        // Or 'cancelled'? User just said "Delete" which implies unassign.
        // If we unassign, it becomes 'waiting' again usually.
        await supabaseAdmin
            .from('orders')
            .update({ assignment_status: 'waiting', assigned_at: null })
            .eq('id', assignment.order_id);

        return NextResponse.json({ success: true });
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
