import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizePhone } from '@/lib/utils';
import { getServerSession, isAdmin } from '@/lib/auth';
import { reindexSlots, syncUsedSlots } from '@/lib/assignment-utils';

export const dynamic = 'force-dynamic';

const assignmentTable = 'legacy_tidal_assignments';
const accountTable = 'legacy_tidal_accounts';

// PUT: Update legacy assignment details
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(req);
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
        }

        const { id } = await params;
        const body = await req.json();

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

        const updates: Record<string, string | number | boolean | null> = {};
        if (tidal_password !== undefined) updates.tidal_password = tidal_password;
        if (tidal_id !== undefined) updates.tidal_id = tidal_id ? tidal_id.toLowerCase().trim() : null;
        if (body.order_number !== undefined) updates.order_number = body.order_number;
        if (type !== undefined) updates.type = type;
        if (buyer_name !== undefined) updates.buyer_name = buyer_name;
        if (buyer_phone !== undefined) updates.buyer_phone = normalizePhone(buyer_phone);
        if (buyer_email !== undefined) updates.buyer_email = buyer_email;
        if (start_date !== undefined) updates.start_date = start_date;
        if (end_date !== undefined) updates.end_date = end_date;
        if (is_active !== undefined) updates.is_active = is_active;
        if (body.is_deleted !== undefined) updates.is_deleted = body.is_deleted;
        if (amount !== undefined && amount !== null) updates.amount = Number(amount);
        if (period_months !== undefined && period_months !== null) updates.period_months = Number(period_months);
        if (_memo !== undefined) updates.memo = _memo;

        if (Object.keys(updates).length > 0) {
            const { data: updatedData, error: updateError } = await supabaseAdmin
                .from(assignmentTable)
                .update(updates)
                .eq('id', id)
                .select('account_id')
                .single();

            if (updateError) throw updateError;

            // Re-index slots if type, is_active, or is_deleted changed
            const shouldReindex = type !== undefined || is_active !== undefined || body.is_deleted !== undefined;
            if (shouldReindex && updatedData) {
                await reindexSlots(updatedData.account_id, assignmentTable, accountTable);
                await syncUsedSlots(updatedData.account_id, accountTable, assignmentTable);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

// DELETE: Soft or Hard delete legacy assignment
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(req);
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
        }

        const { id } = await params;
        const hardDelete = req.nextUrl.searchParams.get('hardDelete') === 'true';

        const { data: assignment, error: fetchError } = await supabaseAdmin
            .from(assignmentTable)
            .select('account_id')
            .eq('id', id)
            .single();

        if (fetchError || !assignment) throw new Error('Assignment not found');

        if (hardDelete) {
            const { error } = await supabaseAdmin
                .from(assignmentTable)
                .delete()
                .eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabaseAdmin
                .from(assignmentTable)
                .update({ is_deleted: true, is_active: false })
                .eq('id', id);
            if (error) throw error;
        }

        // 3. Re-index and Sync
        await reindexSlots(assignment.account_id, assignmentTable, accountTable);
        await syncUsedSlots(assignment.account_id, accountTable, assignmentTable);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
