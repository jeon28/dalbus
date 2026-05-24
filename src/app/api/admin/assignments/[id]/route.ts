import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizePhone } from '@/lib/utils';
import { reindexSlots } from '@/lib/assignment-utils';

export const dynamic = 'force-dynamic';

// PUT: Update assignment and linked order details
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params; // order_accounts.id or legacy_tidal_account.id
        const assignmentTable = 'tidal_assignments';
        const body = await req.json();

        // body contains: tidal_password, buyer_name, buyer_phone, buyer_email, start_date, end_date, type, is_active
        const {
            tidal_password,
            buyer_name,
            buyer_phone,
            buyer_email,
            start_date,
            end_date,
            type,
            is_active,
            tidal_id,
            amount,
            period_months,
            memo: _memo
        } = body;

        // 1. Update order_accounts
        const oaUpdates: Record<string, string | number | boolean | null> = {};
        if (tidal_password !== undefined) oaUpdates.tidal_password = tidal_password;
        if (tidal_id !== undefined) oaUpdates.tidal_id = tidal_id ? tidal_id.toLowerCase().trim() : null;
        if (body.order_number !== undefined) oaUpdates.order_number = body.order_number;
        if (type !== undefined) {
            oaUpdates.type = type;
            // Removed: oaUpdates.slot_number = 0; here to avoid immediate constraint violation.
            // Re-indexing logic below will handle the move to slot 0 safely.
        }
        if (buyer_name !== undefined) oaUpdates.buyer_name = buyer_name;
        if (buyer_phone !== undefined) oaUpdates.buyer_phone = normalizePhone(buyer_phone);
        if (buyer_email !== undefined) oaUpdates.buyer_email = buyer_email;
        if (start_date !== undefined) oaUpdates.start_date = start_date;
        if (end_date !== undefined) oaUpdates.end_date = end_date;
        if (is_active !== undefined) oaUpdates.is_active = is_active;
        if (body.is_deleted !== undefined) oaUpdates.is_deleted = body.is_deleted;
        if (amount !== undefined && amount !== null) oaUpdates.amount = Number(amount);
        if (period_months !== undefined && period_months !== null) oaUpdates.period_months = Number(period_months);
        if (_memo !== undefined) {
            oaUpdates.memo = _memo;
        }


        if (Object.keys(oaUpdates).length > 0) {
            const { data: updatedData, error: oaError } = await supabaseAdmin
                .from(assignmentTable)
                .update(oaUpdates)
                .eq('id', id)
                .select('account_id') // Fetch account_id to update slots
                .single();

            if (oaError) throw oaError;

            // 2. Re-index slots if type, is_active, or is_deleted changed
            const shouldReindex = type !== undefined || is_active !== undefined || body.is_deleted !== undefined;
            if (shouldReindex && updatedData) {
                await reindexSlots(updatedData.account_id, 'tidal_assignments', 'tidal_accounts');
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        const e = error as { code?: string; message: string };
        if (e.code === '23505') {
            return NextResponse.json({ error: '이미 사용 중인 Tidal ID입니다. (활성 계정 중복)' }, { status: 409 });
        }
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE: Unassign (Remove from order_accounts) or Hard Delete history
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params; // order_accounts.id or legacy_tidal_account.id
        const assignmentTable = 'tidal_assignments';

        // 1. Get info before delete
        const { data: assignment, error: fetchError } = await supabaseAdmin
            .from(assignmentTable)
            .select('account_id, order_id')
            .eq('id', id)
            .single();

        if (fetchError || !assignment) throw new Error('Assignment not found');

        // 2. Delete or Soft Delete assignment
        const hardDelete = req.nextUrl.searchParams.get('hardDelete') === 'true';
        let delError;
        
        if (hardDelete) {
            const { error } = await supabaseAdmin
                .from(assignmentTable)
                .delete()
                .eq('id', id);
            delError = error;
        } else {
            const { error } = await supabaseAdmin
                .from(assignmentTable)
                .update({ is_deleted: true, is_active: false })
                .eq('id', id);
            delError = error;
        }


        if (delError) throw delError;

        // 3. Re-index remaining slots
        await reindexSlots(assignment.account_id, 'tidal_assignments', 'tidal_accounts');

        // 5. Update Order Status: 남은 active 배정이 없을 때만 'waiting'으로 복원
        if (assignment.order_id) {
            const { count: remaining } = await supabaseAdmin
                .from('tidal_assignments')
                .select('id', { count: 'exact', head: true })
                .eq('order_id', assignment.order_id)
                .eq('is_active', true)
                .eq('is_deleted', false);

            if (!remaining || remaining === 0) {
                await supabaseAdmin
                    .from('orders')
                    .update({ assignment_status: 'waiting', assigned_at: null })
                    .eq('id', assignment.order_id);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
